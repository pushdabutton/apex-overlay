// ============================================================
// IPC Handlers -- Unit Tests
// Tests the repository methods that IPC handlers delegate to.
// Uses shared test helpers. Validates the data contract that
// the renderer receives (camelCase, not snake_case).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { MatchRepository } from '../../src/main/db/repositories/match-repo';
import { SessionRepository } from '../../src/main/db/repositories/session-repo';
import { LegendStatsRepository } from '../../src/main/db/repositories/legend-stats-repo';
import { CoachingRepository } from '../../src/main/db/repositories/coaching-repo';
import { InsightType, InsightSeverity } from '../../src/shared/types';
import { createTestDb } from '../helpers/db';
import { sampleMatch } from '../helpers/fixtures';

describe('IPC Handler Data Contracts', () => {
  let db: Database.Database;
  let matchRepo: MatchRepository;
  let sessionRepo: SessionRepository;
  let legendRepo: LegendStatsRepository;
  let coachingRepo: CoachingRepository;

  beforeEach(() => {
    db = createTestDb();
    matchRepo = new MatchRepository(db);
    sessionRepo = new SessionRepository(db);
    legendRepo = new LegendStatsRepository(db);
    coachingRepo = new CoachingRepository(db);
  });

  it('get-session-stats: should return current session data with aggregates', () => {
    const sessionId = sessionRepo.create();
    matchRepo.create(sampleMatch(sessionId, { kills: 5, damage: 1200 }));
    matchRepo.create(sampleMatch(sessionId, { kills: 8, damage: 2000, startedAt: '2026-04-26T12:30:00Z' }));

    sessionRepo.updateAggregates(sessionId);
    const session = sessionRepo.findById(sessionId);

    expect(session).toBeDefined();
    expect(session!.matchesPlayed).toBe(2);
    expect(session!.totalKills).toBe(13);
    expect(session!.totalDamage).toBe(3200);
  });

  it('get-match-history: should return recent matches for a session', () => {
    const sessionId = sessionRepo.create();
    matchRepo.create(sampleMatch(sessionId));
    matchRepo.create(sampleMatch(sessionId, { legend: 'Octane', startedAt: '2026-04-26T12:30:00Z' }));

    const matches = matchRepo.findBySessionId(sessionId);
    expect(matches).toHaveLength(2);
    // Newest first
    expect(matches[0].legend).toBe('Octane');
    expect(matches[1].legend).toBe('Wraith');
  });

  it('get-legend-stats: should return per-legend breakdown', () => {
    const sessionId = sessionRepo.create();
    matchRepo.create(sampleMatch(sessionId, { legend: 'Wraith', kills: 5 }));
    matchRepo.create(sampleMatch(sessionId, { legend: 'Octane', kills: 10, startedAt: '2026-04-26T12:10:00Z' }));
    matchRepo.create(sampleMatch(sessionId, { legend: 'Wraith', kills: 7, startedAt: '2026-04-26T12:15:00Z' }));

    legendRepo.recalculate('Wraith');
    legendRepo.recalculate('Octane');

    const allStats = legendRepo.findAll();
    expect(allStats).toHaveLength(2);

    const wraith = legendRepo.findByLegend('Wraith')!;
    expect(wraith.gamesPlayed).toBe(2);
    expect(wraith.totalKills).toBe(12);

    const octane = legendRepo.findByLegend('Octane')!;
    expect(octane.gamesPlayed).toBe(1);
    expect(octane.totalKills).toBe(10);
  });

  it('get-coaching-insights: should return insights for a specific match', () => {
    const sessionId = sessionRepo.create();
    const matchId = matchRepo.create(sampleMatch(sessionId));

    coachingRepo.save({
      matchId,
      sessionId,
      type: InsightType.SESSION_VS_AVERAGE,
      ruleId: 'session-kills',
      message: 'Kills above average',
      severity: InsightSeverity.ACHIEVEMENT,
      dataJson: { delta: 15 },
    });

    coachingRepo.save({
      matchId,
      sessionId,
      type: InsightType.TREND_IMPROVING,
      ruleId: 'trend-damage',
      message: 'Damage trending up',
      severity: InsightSeverity.INFO,
      dataJson: null,
    });

    const insights = coachingRepo.findByMatchId(matchId);
    expect(insights).toHaveLength(2);
    expect(insights[0].matchId).toBe(matchId);
    expect(insights[1].matchId).toBe(matchId);
  });
});
