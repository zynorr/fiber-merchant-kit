/**
 * SQL.js Database Wrapper
 *
 * Provides a better-sqlite3-compatible API (prepare().get() / .all() / .run()).
 * sql.js is pure WASM — no native compilation needed.
 */

// Ambient declaration so TypeScript can resolve 'sql.js'
declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: unknown[]): Record<string, unknown>;
    free(): boolean;
    reset(): void;
  }
  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }
  export default function initSqlJs(
    config?: { locateFile?: (file: string) => string },
  ): Promise<SqlJsStatic>;
}

import initSqlJs, { Database as SqlJsDb } from 'sql.js';
import fs from 'fs';
import path from 'path';

/** Locate the sql.js WASM file — works in both dev (tsx) and production (tsup builds) */
function locateSqlWasm(file: string): string {
  try {
    return require.resolve('sql.js/dist/' + file);
  } catch {
    return file;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ── Prepared Statement wrapper ─────────────────────────────────

class PreparedStmt {
  constructor(
    private db: SqlJsDb,
    private sql: string,
    private onWrite: () => void,
  ) {}

  /** Get a single row or undefined */
  get<T = Row>(...params: unknown[]): T | undefined {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    let row: T | undefined;
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as T;
    }
    stmt.free();
    return row;
  }

  /** Get all matching rows */
  all<T = Row>(...params: unknown[]): T[] {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return rows;
  }

  /** Execute a statement (INSERT / UPDATE / DELETE) — auto-saves on write */
  run(...params: unknown[]): { changes: number } {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    this.onWrite();
    return { changes: this.db.getRowsModified() };
  }
}

// ── Database Wrapper ───────────────────────────────────────────

export class DbWrapper {
  private db: SqlJsDb | null = null;
  private dbPath: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /** Initialize the WASM module and load/create the database */
  async init(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: locateSqlWasm });

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db!.run('PRAGMA foreign_keys = ON');
  }

  /** Prepare a SQL statement for execution */
  prepare(sql: string): PreparedStmt {
    if (!this.db) throw new Error('Database not initialised. Call initDatabase() first.');
    return new PreparedStmt(this.db, sql, () => this.scheduleSave());
  }

  /** Execute raw SQL (for DDL like CREATE TABLE) */
  exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialised. Call initDatabase() first.');
    this.db.exec(sql);
  }

  /** Schedule a save-to-file (debounced) */
  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 1_000);
  }

  /** Save the database to disk immediately */
  save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /** Close the database and save */
  close(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.save();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
