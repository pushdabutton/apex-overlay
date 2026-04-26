// ============================================================
// Match Repository -- Data access for the matches table
// Includes row mapper to convert snake_case DB columns to
// camelCase TypeScript properties.
// ============================================================

import type Database from 'better-sqlite3';
import type { Match } from '../../../shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMatchRow(row: any): Match {
  return {
    id: row.id,
    matchId: row.match_id ?? null,
    sessionId: row.session_id,
    legend: row.legend,
    map: row.map ?? null,
    mode: row.mode ?? 'unknown',
    placement: row.placement ?? null,
    kills: row.kills ?? 0,
    deaths: row.deaths ?? 0,
    assists: row.assists ?? 0,
    damage: row.damage ?? 0,
    headshots: row.headshots ?? 0,
    shotsFired: row.shots_fired ?? 0,
    shotsHit: row.shots_hit ?? 0,
    knockdowns: row.knockdowns ?? 0,
    revives: row.revives ?? 0,
    respawns: row.respawns ?? 0,
    survivalTime: row.survival_time ?? 0,
    rpChange: row.rp_change ?? null,
    duration: row.duration ?? 0,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
  };
}

export class MatchRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Insert a new match and return its auto-generated ID.
   */
  create(match: Omit<Match, 'id'>): number {
    const result = this.db.prepare(`
      INSERT INTO matches (
        match_id, session_id, legend, map, mode,
        placement, kills, deaths, assists, damage,
        headshots, shots_fired, shots_hit, knockdowns,
        revives, respawns, survival_time, rp_change,
        duration, started_at, ended_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      match.matchId,
      match.sessionId,
      match.legend,
      match.map,
      match.mode,
      match.placement,
      match.kills,
      match.deaths,
      match.assists,
      match.damage,
      match.headshots,
      match.shotsFired,
      match.shotsHit,
      match.knockdowns,
      match.revives,
      match.respawns,
      match.survivalTime,
      match.rpChange,
      match.duration,
      match.startedAt,
      match.endedAt,
    );
    return Number(result.lastInsertRowid);
  }

  findById(id: number): Match | undefined {
    const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
    return row ? mapMatchRow(row) : undefined;
  }

  findBySessionId(sessionId: number): Match[] {
    const rows = this.db.prepare(
      'SELECT * FROM matches WHERE session_id = ? ORDER BY started_at DESC',
    ).all(sessionId);
    return rows.map(mapMatchRow);
  }

  findRecent(limit: number = 20): Match[] {
    const rows = this.db.prepare(
      'SELECT * FROM matches ORDER BY started_at DESC LIMIT ?',
    ).all(limit);
    return rows.map(mapMatchRow);
  }

  findByLegend(legend: string, limit: number = 50): Match[] {
    const rows = this.db.prepare(
      'SELECT * FROM matches WHERE legend = ? ORDER BY started_at DESC LIMIT ?',
    ).all(legend, limit);
    return rows.map(mapMatchRow);
  }

  countByLegend(): Array<{ legend: string; count: number }> {
    return this.db.prepare(
      'SELECT legend, COUNT(*) as count FROM matches GROUP BY legend ORDER BY count DESC',
    ).all() as Array<{ legend: string; count: number }>;
  }
}
