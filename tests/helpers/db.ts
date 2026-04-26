// ============================================================
// Shared Test Helper: Database Setup
// Creates an in-memory SQLite database using the real migration
// SQL so tests always match the production schema.
// ============================================================

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../../src/main/db/migrations/001-initial-schema.sql'),
  'utf-8',
);

/**
 * Create a fresh in-memory SQLite database with the full schema applied.
 * Optionally seeds a session row for FK satisfaction.
 */
export function createTestDb(options?: { seedSessions?: number }): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION_SQL);

  const count = options?.seedSessions ?? 0;
  for (let i = 0; i < count; i++) {
    db.exec(
      `INSERT INTO sessions (started_at) VALUES ('2026-04-26T${String(10 + i).padStart(2, '0')}:00:00Z')`,
    );
  }

  return db;
}
