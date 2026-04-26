// ============================================================
// Coaching Repository -- Data access for coaching_insights table
// Includes row mapper for snake_case -> camelCase conversion.
// ============================================================

import type Database from 'better-sqlite3';
import type { CoachingInsight } from '../../../shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapInsightRow(row: any): CoachingInsight {
  return {
    id: row.id,
    matchId: row.match_id ?? null,
    sessionId: row.session_id ?? null,
    type: row.type,
    ruleId: row.rule_id,
    message: row.message,
    severity: row.severity,
    dataJson: row.data_json ? JSON.parse(row.data_json) : null,
    dismissed: Boolean(row.dismissed),
    createdAt: row.created_at,
  };
}

export class CoachingRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  findByMatchId(matchId: number): CoachingInsight[] {
    const rows = this.db.prepare(
      'SELECT * FROM coaching_insights WHERE match_id = ? ORDER BY created_at DESC',
    ).all(matchId);
    return rows.map(mapInsightRow);
  }

  findBySessionId(sessionId: number): CoachingInsight[] {
    const rows = this.db.prepare(
      'SELECT * FROM coaching_insights WHERE session_id = ? ORDER BY created_at DESC',
    ).all(sessionId);
    return rows.map(mapInsightRow);
  }

  findRecent(limit: number = 20): CoachingInsight[] {
    const rows = this.db.prepare(
      'SELECT * FROM coaching_insights WHERE dismissed = 0 ORDER BY created_at DESC LIMIT ?',
    ).all(limit);
    return rows.map(mapInsightRow);
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
