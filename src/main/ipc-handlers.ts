// ============================================================
// IPC Handler Registration -- Routes renderer requests to
// repository methods that apply proper row mappers.
// All handlers wrapped in try/catch for error resilience.
// ============================================================

import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { IPC } from '../shared/ipc-channels';
import { SessionRepository } from './db/repositories/session-repo';
import { MatchRepository } from './db/repositories/match-repo';
import { LegendStatsRepository } from './db/repositories/legend-stats-repo';
import { CoachingRepository } from './db/repositories/coaching-repo';

export function registerIpcHandlers(db: Database.Database): void {
  const sessionRepo = new SessionRepository(db);
  const matchRepo = new MatchRepository(db);
  const legendStatsRepo = new LegendStatsRepository(db);
  const coachingRepo = new CoachingRepository(db);

  // --- Settings (simple key-value, no snake_case mapping needed) ---

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: string) => {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    } catch (error) {
      console.error('[IPC] SETTINGS_GET failed:', error);
      return null;
    }
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: string, value: string) => {
    try {
      const stmt = db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      );
      stmt.run(key, value);
      return true;
    } catch (error) {
      console.error('[IPC] SETTINGS_SET failed:', error);
      return { error: String(error) };
    }
  });

  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    try {
      const stmt = db.prepare('SELECT key, value FROM settings');
      const rows = stmt.all() as { key: string; value: string }[];
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    } catch (error) {
      console.error('[IPC] SETTINGS_GET_ALL failed:', error);
      return {};
    }
  });

  // --- Session History (uses repo with row mapper) ---

  ipcMain.handle(IPC.SESSION_HISTORY, (_event, limit: number = 10) => {
    try {
      return sessionRepo.findRecent(limit);
    } catch (error) {
      console.error('[IPC] SESSION_HISTORY failed:', error);
      return [];
    }
  });

  // --- Match History (uses repo with row mapper) ---

  ipcMain.handle(IPC.MATCH_HISTORY, (_event, sessionId: number) => {
    try {
      return matchRepo.findBySessionId(sessionId);
    } catch (error) {
      console.error('[IPC] MATCH_HISTORY failed:', error);
      return [];
    }
  });

  // --- Legend Stats (uses repo with row mapper) ---

  ipcMain.handle(IPC.LEGEND_STATS, () => {
    try {
      return legendStatsRepo.findAll();
    } catch (error) {
      console.error('[IPC] LEGEND_STATS failed:', error);
      return [];
    }
  });

  // --- Coaching Insights History (uses repo with row mapper) ---

  ipcMain.handle(IPC.INSIGHTS_HISTORY, (_event, limit: number = 20) => {
    try {
      return coachingRepo.findRecent(limit);
    } catch (error) {
      console.error('[IPC] INSIGHTS_HISTORY failed:', error);
      return [];
    }
  });
}
