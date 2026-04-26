// ============================================================
// Match Repository -- Data access for the matches table
// ============================================================

import type Database from 'better-sqlite3';
import type { Match } from '../../../shared/types';

export class MatchRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  findById(id: number): Match | undefined {
    return this.db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as Match | undefined;
  }

  findBySessionId(sessionId: number): Match[] {
    return this.db.prepare(
      'SELECT * FROM matches WHERE session_id = ? ORDER BY started_at DESC',
    ).all(sessionId) as Match[];
  }

  findRecent(limit: number = 20): Match[] {
    return this.db.prepare(
      'SELECT * FROM matches ORDER BY started_at DESC LIMIT ?',
    ).all(limit) as Match[];
  }

  findByLegend(legend: string, limit: number = 50): Match[] {
    return this.db.prepare(
      'SELECT * FROM matches WHERE legend = ? ORDER BY started_at DESC LIMIT ?',
    ).all(legend, limit) as Match[];
  }

  countByLegend(): Array<{ legend: string; count: number }> {
    return this.db.prepare(
      'SELECT legend, COUNT(*) as count FROM matches GROUP BY legend ORDER BY count DESC',
    ).all() as Array<{ legend: string; count: number }>;
  }
}
