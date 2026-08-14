import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: SqlJsDatabase | null = null;
const dbFilePath = path.resolve(process.cwd(), 'database.sqlite');

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    const filebuffer = fs.readFileSync(dbFilePath);
    dbInstance = new SQL.Database(filebuffer);
  } else {
    dbInstance = new SQL.Database();
    persistDb(dbInstance);
  }
  return dbInstance;
}

export function persistDb(db?: SqlJsDatabase): void {
  const targetDb = db || dbInstance;
  if (!targetDb) return;
  try {
    const data = targetDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const results = await dbQuery<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export async function dbRun(sql: string, params: any[] = []): Promise<void> {
  const db = await getDb();
  db.run(sql, params);
  persistDb(db);
}

export async function dbExec(sql: string): Promise<void> {
  const db = await getDb();
  db.exec(sql);
  persistDb(db);
}
