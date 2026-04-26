// ============================================================
// Database Initialization -- SQLite connection + migrations
// ============================================================

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { readFileSync, readdirSync } from 'fs';

let db: Database.Database;

export function initializeDatabase(): Database.Database {
  if (db) return db;

  const dbPath = join(app.getPath('userData'), 'apex-coach.sqlite3');
  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('cache_size = -64000');

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Read migration files
  const migrationsDir = join(__dirname, 'migrations');
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    // Migrations directory might not exist in dev
    console.warn('No migrations directory found at', migrationsDir);
    return;
  }

  // Apply pending migrations
  const applied = new Set(
    (database.prepare('SELECT filename FROM _migrations').all() as { filename: string }[])
      .map((r) => r.filename)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    database.transaction(() => {
      database.exec(sql);
      database.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    })();

    console.log(`Migration applied: ${file}`);
  }
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
  return db;
}
