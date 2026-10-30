import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
// Helper to detect where the actual tabular headers start
function findHeaderRowIndex(rawGrid) {
  let bestRowIdx = 0;
  let maxCols = 0;

  // Scan the first 25 rows to find the densest string-based row
  for (let i = 0; i < Math.min(rawGrid.length, 25); i++) {
    const row = rawGrid[i] || [];
    const populatedCols = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    
    if (populatedCols > maxCols) {
      maxCols = populatedCols;
      bestRowIdx = i;
    }
  }
  return bestRowIdx;
}

function getSafeTableName(sheetName) {
  let clean = sheetName.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  clean = clean.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!clean || /^[0-9]/.test(clean)) {
    clean = `t_${clean}`;
  }
  return clean;
}

function getSafeColumnName(colName, index) {
  if (!colName || typeof colName !== 'string') {
    return `col_${index}`;
  }
  let clean = colName.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  clean = clean.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!clean || /^[0-9]/.test(clean)) {
    clean = `col_${clean}`;
  }
  return clean;
}

export class SessionDatabase {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.dbPath = path.join(os.tmpdir(), `${sessionId}.duckdb`);
    this.db = new duckdb.Database(this.dbPath);
  }

  query(sql) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

async ingestExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const tableSchemas = [];

    for (const sheetName of workbook.SheetNames) {
      const sanitizedTableName = getSafeTableName(sheetName);
      
      // 1. Read sheet as a 2D array of raw rows
      const rawGrid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null });
      if (!rawGrid || rawGrid.length === 0) continue;

      // 2. Identify header row (skipping banner/metadata rows)
      const headerIdx = findHeaderRowIndex(rawGrid);
      const rawHeaderRow = rawGrid[headerIdx] || [];


      // 3. Extract, sanitize, and deduplicate column names
      const seenHeaders = new Map();
      const headers = rawHeaderRow.map((col, idx) => {
        let name = getSafeColumnName(String(col || ''), idx);
        if (seenHeaders.has(name)) {
          const count = seenHeaders.get(name) + 1;
          seenHeaders.set(name, count);
          name = `${name}_${count}`;
        } else {
          seenHeaders.set(name, 1);
        }
        return name;
      });

      // 4. Transform data rows that follow the header
      const sanitizedRows = [];
      for (let r = headerIdx + 1; r < rawGrid.length; r++) {
        const row = rawGrid[r];
        if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue; // skip blank lines

        const cleanRow = {};
        headers.forEach((header, cIdx) => {
          cleanRow[header] = row[cIdx] !== undefined ? row[cIdx] : null;
        });
        sanitizedRows.push(cleanRow);
      }

      if (sanitizedRows.length === 0) continue;

      const tempJsonPath = path.join(os.tmpdir(), `${this.sessionId}_${sanitizedTableName}.json`);
      fs.writeFileSync(tempJsonPath, JSON.stringify(sanitizedRows));

      const normalizedJsonPath = tempJsonPath.replace(/\\/g, '/');

      await this.query(`DROP TABLE IF EXISTS "${sanitizedTableName}";`);
      await this.query(`
        CREATE TABLE "${sanitizedTableName}" AS 
        SELECT * FROM read_json_auto('${normalizedJsonPath}');
      `);

      fs.unlinkSync(tempJsonPath);

      const columns = await this.query(`DESCRIBE "${sanitizedTableName}";`);
      const sample = await this.query(`SELECT * FROM "${sanitizedTableName}" LIMIT 2;`);

      tableSchemas.push({
        tableName: sanitizedTableName,
        columns: columns.map(c => `${c.column_name} (${c.column_type})`),
        sampleRows: sample
      });
    }

    return tableSchemas;
  }
}