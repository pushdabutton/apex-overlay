// ============================================================
// IPC Handler Registration -- Routes renderer requests to
// appropriate main-process services
// ============================================================

import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { IPC } from '../shared/ipc-channels';
import { CoachingEngine } from './coaching/engine';

export function registerIpcHandlers(db: Database.Database, coaching: CoachingEngine): void {
  // --- Settings ---

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: string) => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: string, value: string) => {
    const stmt = db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    stmt.run(key, value);
    return true;
  });

  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    const stmt = db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  // --- Session History ---

  ipcMain.handle(IPC.SESSION_HISTORY, (_event, limit: number = 10) => {
    const stmt = db.prepare(
      'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?'
    );
    return stmt.all(limit);
  });

  // --- Match History ---

  ipcMain.handle(IPC.MATCH_HISTORY, (_event, sessionId: number) => {
    const stmt = db.prepare(
      'SELECT * FROM matches WHERE session_id = ? ORDER BY started_at DESC'
    );
    return stmt.all(sessionId);
  });

  // --- Legend Stats ---

  ipcMain.handle(IPC.LEGEND_STATS, () => {
    const stmt = db.prepare(
      'SELECT * FROM legend_stats ORDER BY games_played DESC'
    );
    return stmt.all();
  });

  // --- Coaching Insights History ---

  ipcMain.handle(IPC.INSIGHTS_HISTORY, (_event, limit: number = 20) => {
    const stmt = db.prepare(
      'SELECT * FROM coaching_insights WHERE dismissed = 0 ORDER BY created_at DESC LIMIT ?'
    );
    return stmt.all(limit);
  });
}
