import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import os from 'os';
import { SessionDatabase } from './db.js';
import { generateSqlAndChartSpec, generateAutoDashboardWidgets } from './ai.js';

// --- Fix BigInt serialization for Express res.json & JSON.stringify ---
BigInt.prototype.toJSON = function () {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: os.tmpdir() });
const sessions = new Map(); // sessionId -> { db, schema }

// 1. Ingest Excel
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const sessionId = crypto.randomUUID();
    const sessionDb = new SessionDatabase(sessionId);
    const schemaContext = await sessionDb.ingestExcel(req.file.path);

    // Save session in memory
    sessions.set(sessionId, { db: sessionDb, schema: schemaContext });

    // Generate starter dashboard
    const starterWidgets = await generateAutoDashboardWidgets(schemaContext);

    // Execute queries for each starter widget
    const resolvedWidgets = await Promise.all(
      starterWidgets.map(async (widget) => {
        try {
          const rows = await sessionDb.query(widget.sql);
          return { ...widget, rows };
        } catch (err) {
          return { ...widget, error: err.message, rows: [] };
        }
      })
    );

    res.json({ sessionId, schema: schemaContext, widgets: resolvedWidgets });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Query Data with Natural Language
app.post('/api/query', async (req, res) => {
  const { sessionId, prompt } = req.body;
  const session = sessions.get(sessionId);

  if (!session) return res.status(404).json({ error: "Session expired or not found." });

  try {
    const aiPlan = await generateSqlAndChartSpec(session.schema, prompt);

    // Guardrail: reject non-SELECT statements
    const normalizedSql = aiPlan.sql.trim().toUpperCase();
    if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH')) {
      throw new Error("Unauthorized SQL generated. Only SELECT/CTE allowed.");
    }

    const rows = await session.db.query(aiPlan.sql);
    res.json({ ...aiPlan, rows });
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running locally on http://localhost:${PORT}`));