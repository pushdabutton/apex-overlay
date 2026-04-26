// ============================================================
// Coaching Repository -- Data access for coaching_insights table
// ============================================================

import type Database from 'better-sqlite3';
import type { CoachingInsight } from '../../../shared/types';

export class CoachingRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  findByMatchId(matchId: number): CoachingInsight[] {
    return this.db.prepare(
      'SELECT * FROM coaching_insights WHERE match_id = ? ORDER BY created_at DESC',
    ).all(matchId) as CoachingInsight[];
  }

  findBySessionId(sessionId: number): CoachingInsight[] {
    return this.db.prepare(
      'SELECT * FROM coaching_insights WHERE session_id = ? ORDER BY created_at DESC',
    ).all(sessionId) as CoachingInsight[];
  }

  findRecent(limit: number = 20): CoachingInsight[] {
    return this.db.prepare(
      'SELECT * FROM coaching_insights WHERE dismissed = 0 ORDER BY created_at DESC LIMIT ?',
    ).all(limit) as CoachingInsight[];
  }

  dismiss(id: number): void {
    this.db.prepare(
      'UPDATE coaching_insights SET dismissed = 1 WHERE id = ?',
    ).run(id);
  }

  pruneOldDismissed(daysOld: number = 30): number {
    const result = this.db.prepare(
      `DELETE FROM coaching_insights WHERE dismissed = 1 AND created_at < datetime('now', '-' || ? || ' days')`,
    ).run(daysOld);
    return result.changes;
  }
}
