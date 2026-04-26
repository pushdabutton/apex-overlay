// ============================================================
// Session Repository -- Data access for the sessions table
// Includes row mapper for snake_case -> camelCase conversion.
// ============================================================

import type Database from 'better-sqlite3';
import type { Session } from '../../../shared/types';
import { nowISO } from '../../../shared/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSessionRow(row: any): Session {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    matchesPlayed: row.matches_played ?? 0,
    totalKills: row.total_kills ?? 0,
    totalDeaths: row.total_deaths ?? 0,
    totalAssists: row.total_assists ?? 0,
    totalDamage: row.total_damage ?? 0,
    totalHeadshots: row.total_headshots ?? 0,
    avgPlacement: row.avg_placement ?? null,
    bestPlacement: row.best_placement ?? null,
    totalRpChange: row.total_rp_change ?? 0,
  };
}

export class SessionRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  findById(id: number): Session | undefined {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return row ? mapSessionRow(row) : undefined;
  }

  findRecent(limit: number = 10): Session[] {
    const rows = this.db.prepare(
      'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?',
    ).all(limit);
    return rows.map(mapSessionRow);
  }

  findActive(): Session | undefined {
    const row = this.db.prepare(
      'SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
    ).get();
    return row ? mapSessionRow(row) : undefined;
  }

  create(): number {
    const result = this.db.prepare(
      'INSERT INTO sessions (started_at) VALUES (?)',
    ).run(nowISO());
    return Number(result.lastInsertRowid);
  }

  close(id: number): void {
    this.db.prepare(
      'UPDATE sessions SET ended_at = ? WHERE id = ?',
    ).run(nowISO(), id);
  }

  updateAggregates(sessionId: number): void {
    this.db.prepare(`
      UPDATE sessions SET
        matches_played = (SELECT COUNT(*) FROM matches WHERE session_id = ?),
        total_kills = (SELECT COALESCE(SUM(kills), 0) FROM matches WHERE session_id = ?),
        total_deaths = (SELECT COALESCE(SUM(deaths), 0) FROM matches WHERE session_id = ?),
        total_assists = (SELECT COALESCE(SUM(assists), 0) FROM matches WHERE session_id = ?),
        total_damage = (SELECT COALESCE(SUM(damage), 0) FROM matches WHERE session_id = ?),
        total_headshots = (SELECT COALESCE(SUM(headshots), 0) FROM matches WHERE session_id = ?),
        avg_placement = (SELECT AVG(placement) FROM matches WHERE session_id = ? AND placement IS NOT NULL),
        best_placement = (SELECT MIN(placement) FROM matches WHERE session_id = ? AND placement IS NOT NULL),
        total_rp_change = (SELECT COALESCE(SUM(rp_change), 0) FROM matches WHERE session_id = ? AND rp_change IS NOT NULL)
      WHERE id = ?
    `).run(
      sessionId, sessionId, sessionId, sessionId, sessionId,
      sessionId, sessionId, sessionId, sessionId, sessionId,
    );
  }
}
