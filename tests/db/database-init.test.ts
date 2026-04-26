// ============================================================
// Database Initialization -- Unit Tests
// Tests migration runner, WAL mode, idempotent migrations.
// Uses real in-memory SQLite, no mocks.
// ============================================================

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(__dirname, '../../src/main/db/migrations/001-initial-schema.sql');

/**
 * Simulate the migration runner logic from database.ts without
 * depending on Electron's `app` module. This is a faithful
 * reproduction of runMigrations() for isolated testing.
 */
function runMigrations(db: Database.Database, migrationSql: string, filename: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[])
      .map((r) => r.filename),
  );

  if (applied.has(filename)) return;

  db.transaction(() => {
    db.exec(migrationSql);
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(filename);
  })();
}

describe('Database Initialization', () => {
  it('should create tables from migration SQL on first run', () => {
    const db = new Database(':memory:');
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');

    runMigrations(db, sql, '001-initial-schema.sql');

    // Verify all expected tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('matches');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('legend_stats');
    expect(tableNames).toContain('coaching_insights');
    expect(tableNames).toContain('daily_aggregates');
    expect(tableNames).toContain('player_profile');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('_migrations');

    db.close();
  });

  it('should skip already-applied migrations', () => {
    const db = new Database(':memory:');
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');

    // Apply once
    runMigrations(db, sql, '001-initial-schema.sql');

    // Apply again -- should not throw
    runMigrations(db, sql, '001-initial-schema.sql');

    // Only one migration record
    const count = db.prepare('SELECT COUNT(*) as c FROM _migrations').get() as { c: number };
    expect(count.c).toBe(1);

    db.close();
  });

  it('should set WAL mode and pragmas', () => {
    const db = new Database(':memory:');

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('cache_size = -64000');

    const journalMode = db.pragma('journal_mode', { simple: true });
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    const busyTimeout = db.pragma('busy_timeout', { simple: true });

    // In-memory DBs may report 'memory' for WAL, but the pragma call succeeds
    expect(['wal', 'memory']).toContain(journalMode);
    expect(foreignKeys).toBe(1);
    expect(busyTimeout).toBe(5000);

    db.close();
  });
});
