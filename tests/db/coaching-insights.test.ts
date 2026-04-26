// ============================================================
// Coaching Insights Persistence -- Unit Tests
// Tests save, query by match, query recent, deduplication.
// Uses real in-memory SQLite, no mocks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CoachingRepository, mapInsightRow } from '../../src/main/db/repositories/coaching-repo';
import type { CoachingInsight } from '../../src/shared/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../../src/main/db/migrations/001-initial-schema.sql'),
  'utf-8',
);

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION_SQL);
  // Create a session and a match for FK references
  db.exec("INSERT INTO sessions (started_at) VALUES ('2026-04-26T10:00:00Z')");
  db.exec(`
    INSERT INTO matches (session_id, legend, started_at)
    VALUES (1, 'Wraith', '2026-04-26T10:05:00Z')
  `);
  db.exec(`
    INSERT INTO matches (session_id, legend, started_at)
    VALUES (1, 'Octane', '2026-04-26T10:30:00Z')
  `);
  return db;
}

/**
 * Helper to insert an insight directly into the DB.
 * The CoachingRepository from Phase 1 only has find/dismiss methods.
 * We need a save() method -- which is what Phase 2 tests require.
 */
function insertInsight(
  db: Database.Database,
  insight: {
    matchId: number | null;
    sessionId: number | null;
    type: string;
    ruleId: string;
    message: string;
    severity: string;
    dataJson?: Record<string, unknown> | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO coaching_insights (match_id, session_id, type, rule_id, message, severity, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    insight.matchId,
    insight.sessionId,
    insight.type,
    insight.ruleId,
    insight.message,
    insight.severity,
    insight.dataJson ? JSON.stringify(insight.dataJson) : null,
  );
  return Number(result.lastInsertRowid);
}

describe('Coaching Insights Persistence', () => {
  let db: Database.Database;
  let repo: CoachingRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new CoachingRepository(db);
  });

  it('should save an insight and persist it to the DB', () => {
    const id = repo.save({
      matchId: 1,
      sessionId: 1,
      type: InsightType.SESSION_VS_AVERAGE,
      ruleId: 'session-kills-compare',
      message: 'Your kills are 20% above average this session',
      severity: InsightSeverity.ACHIEVEMENT,
      dataJson: { delta: 20 },
    });

    expect(id).toBeGreaterThan(0);

    const insights = repo.findByMatchId(1);
    expect(insights).toHaveLength(1);
    expect(insights[0].message).toBe('Your kills are 20% above average this session');
    expect(insights[0].ruleId).toBe('session-kills-compare');
    expect(insights[0].dataJson).toEqual({ delta: 20 });
  });

  it('should find insights by match ID', () => {
    repo.save({
      matchId: 1, sessionId: 1,
      type: InsightType.TREND_IMPROVING, ruleId: 'trend-kills',
      message: 'Kills improving', severity: InsightSeverity.INFO, dataJson: null,
    });
    repo.save({
      matchId: 1, sessionId: 1,
      type: InsightType.LEGEND_RECOMMENDATION, ruleId: 'legend-switch',
      message: 'Try Horizon', severity: InsightSeverity.SUGGESTION, dataJson: null,
    });
    repo.save({
      matchId: 2, sessionId: 1,
      type: InsightType.DEATH_TIMING, ruleId: 'early-death',
      message: 'Early deaths detected', severity: InsightSeverity.WARNING, dataJson: null,
    });

    const match1Insights = repo.findByMatchId(1);
    expect(match1Insights).toHaveLength(2);

    const match2Insights = repo.findByMatchId(2);
    expect(match2Insights).toHaveLength(1);
    expect(match2Insights[0].type).toBe(InsightType.DEATH_TIMING);
  });

  it('should find recent insights in newest-first order', () => {
    // Insert with slight time differences (SQLite datetime('now') has second granularity,
    // so we insert manually with explicit timestamps)
    db.prepare(`
      INSERT INTO coaching_insights (match_id, session_id, type, rule_id, message, severity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, 'trend_improving', 'trend-1', 'Older insight', 'info', '2026-04-26T10:00:00Z');

    db.prepare(`
      INSERT INTO coaching_insights (match_id, session_id, type, rule_id, message, severity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, 'trend_declining', 'trend-2', 'Newer insight', 'warning', '2026-04-26T11:00:00Z');

    const recent = repo.findRecent(10);
    expect(recent).toHaveLength(2);
    expect(recent[0].message).toBe('Newer insight');
    expect(recent[1].message).toBe('Older insight');
  });

  it('should deduplicate -- same insight type for same match not duplicated', () => {
    const insight = {
      matchId: 1 as number | null,
      sessionId: 1 as number | null,
      type: InsightType.SESSION_VS_AVERAGE,
      ruleId: 'session-kills-compare',
      message: 'Kills above average',
      severity: InsightSeverity.INFO,
      dataJson: null,
    };

    // Save first time
    repo.save(insight);
    // Save same type+match again -- should be deduplicated
    repo.save(insight);

    const insights = repo.findByMatchId(1);
    // Should only have 1 insight, not 2
    expect(insights).toHaveLength(1);
  });
});
