import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

export class SessionDatabase {
  constructor(sessionId) {
    this.sessionId = sessionId;
    // Uses OS-independent temp directory (works on Windows & Linux)
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
      const sanitizedTableName = sheetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

      if (rawJson.length === 0) continue;

      const sanitizedRows = rawJson.map(row => {
        const cleanRow = {};
        for (const [key, val] of Object.entries(row)) {
          const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          cleanRow[cleanKey] = val;
        }
        return cleanRow;
      });

      const tempJsonPath = path.join(os.tmpdir(), `${this.sessionId}_${sanitizedTableName}.json`);
      fs.writeFileSync(tempJsonPath, JSON.stringify(sanitizedRows));

      // DuckDB expects forward slashes even on Windows paths
      const normalizedJsonPath = tempJsonPath.replace(/\\/g, '/');

      await this.query(`DROP TABLE IF EXISTS ${sanitizedTableName};`);
      await this.query(`
        CREATE TABLE ${sanitizedTableName} AS 
        SELECT * FROM read_json_auto('${normalizedJsonPath}');
      `);

      fs.unlinkSync(tempJsonPath);

      const columns = await this.query(`DESCRIBE ${sanitizedTableName};`);
      const sample = await this.query(`SELECT * FROM ${sanitizedTableName} LIMIT 2;`);

      tableSchemas.push({
        tableName: sanitizedTableName,
        columns: columns.map(c => `${c.column_name} (${c.column_type})`),
        sampleRows: sample
      });
    }

    return tableSchemas;
  }
}