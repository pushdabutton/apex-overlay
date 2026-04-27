// ============================================================
// Session Comparison Rule -- Unit Tests
// Tests that the rule compares current session metrics to
// 7-day rolling averages and produces appropriate insights.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { SessionComparisonRule } from '../../src/main/coaching/rules/session-comparison';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

function createMockContext(queryOneResponses: Record<string, unknown>): RuleContext {
  return {
    query: vi.fn(() => []),
    queryOne: vi.fn((sql: string) => {
      // Return different results based on which table is queried
      if (sql.includes('sessions')) return queryOneResponses['session'];
      if (sql.includes('daily_aggregates')) return queryOneResponses['weekly'];
      return undefined;
    }),
  };
}

describe('SessionComparisonRule', () => {
  const rule = new SessionComparisonRule();

  it('should emit achievement when kills are 15%+ above weekly average', () => {
    const ctx = createMockContext({
      session: { matches_played: 5, total_kills: 20, total_deaths: 5, total_damage: 5000, total_headshots: 8, avg_placement: 5 },
      weekly: { avg_kills: 2.0, avg_damage: 600, avg_headshots: 1, avg_placement: 8 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    // Session avg kills = 20/5 = 4.0, weekly avg = 2.0 => +100% delta
    const killsInsight = results.find(r => r.data && (r.data as Record<string, unknown>).metric === 'kills');
    expect(killsInsight).toBeDefined();
    expect(killsInsight!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    expect(killsInsight!.type).toBe(InsightType.SESSION_VS_AVERAGE_KILLS);
  });

  it('should emit warning when kills are 15%+ below weekly average', () => {
    const ctx = createMockContext({
      session: { matches_played: 5, total_kills: 2, total_deaths: 10, total_damage: 2000, total_headshots: 0, avg_placement: 12 },
      weekly: { avg_kills: 3.0, avg_damage: 800, avg_headshots: 2, avg_placement: 5 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    // Session avg kills = 2/5 = 0.4, weekly = 3.0 => -87% delta
    const killsInsight = results.find(r => r.data && (r.data as Record<string, unknown>).metric === 'kills');
    expect(killsInsight).toBeDefined();
    expect(killsInsight!.severity).toBe(InsightSeverity.WARNING);
  });

  it('should emit nothing when session has fewer than 2 matches', () => {
    const ctx = createMockContext({
      session: { matches_played: 1, total_kills: 5, total_deaths: 0, total_damage: 1500, total_headshots: 2, avg_placement: 3 },
      weekly: { avg_kills: 2.0, avg_damage: 600, avg_headshots: 1, avg_placement: 8 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);
    expect(results).toHaveLength(0);
  });

  it('should emit nothing when no daily aggregates exist', () => {
    const ctx = createMockContext({
      session: { matches_played: 5, total_kills: 10, total_deaths: 3, total_damage: 3000, total_headshots: 4, avg_placement: 6 },
      weekly: undefined,
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);
    expect(results).toHaveLength(0);
  });

  it('should compare damage independently from kills', () => {
    const ctx = createMockContext({
      // Kills average (10/5=2) matches weekly (2.0) => no kills insight
      // Damage average (6000/5=1200) vs weekly (600) => +100% => achievement
      session: { matches_played: 5, total_kills: 10, total_deaths: 5, total_damage: 6000, total_headshots: 3, avg_placement: 5 },
      weekly: { avg_kills: 2.0, avg_damage: 600, avg_headshots: 1, avg_placement: 8 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const damageInsight = results.find(r => r.data && (r.data as Record<string, unknown>).metric === 'damage');
    expect(damageInsight).toBeDefined();
    expect(damageInsight!.severity).toBe(InsightSeverity.ACHIEVEMENT);

    // Kills should NOT trigger (delta is 0%)
    const killsInsight = results.find(r => r.data && (r.data as Record<string, unknown>).metric === 'kills');
    expect(killsInsight).toBeUndefined();
  });

  it('should emit nothing when session query returns undefined', () => {
    const ctx = createMockContext({
      session: undefined,
      weekly: { avg_kills: 2.0, avg_damage: 600, avg_headshots: 1, avg_placement: 8 },
    });

    const results = rule.evaluatePostMatch(1, 1, ctx);
    expect(results).toHaveLength(0);
  });
});
