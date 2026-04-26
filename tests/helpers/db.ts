// ============================================================
// Shared Test Helper: Database Setup
// Creates an in-memory SQLite database using the real migration
// SQL so tests always match the production schema.
// ============================================================

import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const MIGRATIONS_DIR = resolve(__dirname, '../../src/main/db/migrations');

// Read all .sql migration files in order (001-..., 002-..., etc.)
const MIGRATION_SQLS = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf-8'));

/**
 * Create a fresh in-memory SQLite database with the full schema applied.
 * Runs ALL migration files in order so tests always match the production schema.
 * Optionally seeds a session row for FK satisfaction.
 */
export function createTestDb(options?: { seedSessions?: number }): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const sql of MIGRATION_SQLS) {
    db.exec(sql);
  }

  const count = options?.seedSessions ?? 0;
  for (let i = 0; i < count; i++) {
    db.exec(
      `INSERT INTO sessions (started_at) VALUES ('2026-04-26T${String(10 + i).padStart(2, '0')}:00:00Z')`,
    );
  }

  return db;
}
