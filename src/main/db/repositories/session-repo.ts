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
    // Single-pass aggregation: one scan of matches instead of 9 subqueries
    const agg = this.db.prepare(`
      SELECT
        COUNT(*) as matches_played,
        COALESCE(SUM(kills), 0) as total_kills,
        COALESCE(SUM(deaths), 0) as total_deaths,
        COALESCE(SUM(assists), 0) as total_assists,
        COALESCE(SUM(damage), 0) as total_damage,
        COALESCE(SUM(headshots), 0) as total_headshots,
        AVG(CASE WHEN placement IS NOT NULL THEN placement END) as avg_placement,
        MIN(CASE WHEN placement IS NOT NULL THEN placement END) as best_placement,
        COALESCE(SUM(CASE WHEN rp_change IS NOT NULL THEN rp_change ELSE 0 END), 0) as total_rp_change
      FROM matches WHERE session_id = ?
    `).get(sessionId) as {
      matches_played: number;
      total_kills: number;
      total_deaths: number;
      total_assists: number;
      total_damage: number;
      total_headshots: number;
      avg_placement: number | null;
      best_placement: number | null;
      total_rp_change: number;
    };

    this.db.prepare(`
      UPDATE sessions SET
        matches_played = ?,
        total_kills = ?,
        total_deaths = ?,
        total_assists = ?,
        total_damage = ?,
        total_headshots = ?,
        avg_placement = ?,
        best_placement = ?,
        total_rp_change = ?
      WHERE id = ?
    `).run(
      agg.matches_played,
      agg.total_kills,
      agg.total_deaths,
      agg.total_assists,
      agg.total_damage,
      agg.total_headshots,
      agg.avg_placement,
      agg.best_placement,
      agg.total_rp_change,
      sessionId,
    );
  }
}
