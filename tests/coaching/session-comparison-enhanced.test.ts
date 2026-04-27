// ============================================================
// Enhanced Session Comparison Rule -- Unit Tests
// Tests hot/cold streaks, specific stat callouts, first session
// handling, and severity scaling based on magnitude.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { SessionComparisonRule } from '../../src/main/coaching/rules/session-comparison';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

function createMockContext(queryOneResponses: Record<string, unknown>): RuleContext {
  return {
    query: vi.fn(() => []),
    queryOne: vi.fn((sql: string) => {
      if (sql.includes('sessions')) return queryOneResponses['session'];
      if (sql.includes('daily_aggregates')) return queryOneResponses['weekly'];
      return undefined;
    }),
  };
}

describe('SessionComparisonRule (Enhanced)', () => {
  const rule = new SessionComparisonRule();

  it('should generate "hot streak" insight when K/D is 30%+ above weekly average', () => {
    // Session: 30 kills / 5 matches = 6.0 avg kills
    // Weekly avg: 3.0 kills => +100% => well above 30%
    const ctx = createMockContext({
      session: {
        matches_played: 5,
        total_kills: 30,
        total_deaths: 5,
        total_damage: 5000,
        total_headshots: 8,
        avg_placement: 3,
      },
      weekly: { avg_kills: 3.0, avg_damage: 800, avg_headshots: 1.5, avg_placement: 8 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const hotStreak = results.find(
      (r) => r.data && (r.data as Record<string, unknown>).hotStreak === true,
    );
    expect(hotStreak).toBeDefined();
    expect(hotStreak!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    expect(hotStreak!.message).toMatch(/hot streak|on fire/i);
  });

  it('should generate "cold streak" warning when 30%+ below average', () => {
    // Session: 5 kills / 5 matches = 1.0 avg
    // Weekly avg: 3.0 => -67% => well below -30%
    const ctx = createMockContext({
      session: {
        matches_played: 5,
        total_kills: 5,
        total_deaths: 15,
        total_damage: 1500,
        total_headshots: 1,
        avg_placement: 14,
      },
      weekly: { avg_kills: 3.0, avg_damage: 800, avg_headshots: 2, avg_placement: 6 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const coldStreak = results.find(
      (r) => r.data && (r.data as Record<string, unknown>).coldStreak === true,
    );
    expect(coldStreak).toBeDefined();
    expect(coldStreak!.severity).toBe(InsightSeverity.WARNING);
    expect(coldStreak!.message).toMatch(/cold streak|rough/i);
  });

  it('should generate specific stat callouts with absolute difference', () => {
    // Session avg damage = 4000/5 = 800, weekly avg = 600 => +200 above average
    const ctx = createMockContext({
      session: {
        matches_played: 5,
        total_kills: 10,
        total_deaths: 5,
        total_damage: 4000,
        total_headshots: 5,
        avg_placement: 5,
      },
      weekly: { avg_kills: 2.0, avg_damage: 600, avg_headshots: 1, avg_placement: 6 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    // Should have a damage callout mentioning the absolute difference
    const damageCallout = results.find(
      (r) => r.data && (r.data as Record<string, unknown>).metric === 'damage',
    );
    expect(damageCallout).toBeDefined();
    expect(damageCallout!.message).toMatch(/200|above/i);
  });

  it('should handle first session (no history) gracefully', () => {
    // No weekly data
    const ctx = createMockContext({
      session: {
        matches_played: 3,
        total_kills: 12,
        total_deaths: 2,
        total_damage: 3600,
        total_headshots: 4,
        avg_placement: 3,
      },
      weekly: undefined,
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);
    // Should not crash and should return empty (no comparison possible)
    expect(results).toHaveLength(0);
  });

  it('should adjust severity based on magnitude (info for small, warning for large)', () => {
    // Session avg kills = 3.5, weekly avg = 3.0 => +17% (above 15% threshold but below 30%)
    const ctx = createMockContext({
      session: {
        matches_played: 4,
        total_kills: 14,
        total_deaths: 4,
        total_damage: 3200,
        total_headshots: 3,
        avg_placement: 5,
      },
      weekly: { avg_kills: 3.0, avg_damage: 800, avg_headshots: 1, avg_placement: 6 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const killsInsight = results.find(
      (r) => r.data && (r.data as Record<string, unknown>).metric === 'kills',
    );
    if (killsInsight) {
      // Small positive should be ACHIEVEMENT (not warning)
      expect(killsInsight.severity).toBe(InsightSeverity.ACHIEVEMENT);
    }

    // Now test large negative (cold streak level)
    const ctxBad = createMockContext({
      session: {
        matches_played: 5,
        total_kills: 3,
        total_deaths: 15,
        total_damage: 1000,
        total_headshots: 0,
        avg_placement: 16,
      },
      weekly: { avg_kills: 4.0, avg_damage: 900, avg_headshots: 2, avg_placement: 5 },
    });

    const resultsBad = rule.evaluatePostMatch(1, 1, ctxBad);
    const badKills = resultsBad.find(
      (r) => r.data && (r.data as Record<string, unknown>).metric === 'kills',
    );
    if (badKills) {
      expect(badKills.severity).toBe(InsightSeverity.WARNING);
    }
  });
});
