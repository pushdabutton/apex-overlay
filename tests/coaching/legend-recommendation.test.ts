// ============================================================
// Legend Recommendation Rule -- Unit Tests
// Tests that the rule recommends switching legends when a
// significant performance gap exists.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { LegendRecommendationRule } from '../../src/main/coaching/rules/legend-recommendation';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

function createMockContext(
  matchLegend: string | undefined,
  mainLegends: Array<{
    legend: string;
    games_played: number;
    avg_kills: number;
    avg_damage: number;
    win_rate: number;
  }>,
  underplayedLegends: Array<{
    legend: string;
    games_played: number;
    avg_kills: number;
    avg_damage: number;
    win_rate: number;
  }> = [],
): RuleContext {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('games_played <') || sql.includes('< ?')) {
        // Underplayed legends query (games_played < threshold AND games_played >= 3)
        return underplayedLegends;
      }
      // Main legends query (games_played >= threshold)
      return mainLegends;
    }),
    queryOne: vi.fn(() => (matchLegend ? { legend: matchLegend } : undefined)),
  };
}

describe('LegendRecommendationRule', () => {
  const rule = new LegendRecommendationRule();

  it('should suggest switching when performance gap > 20%', () => {
    const ctx = createMockContext('Bangalore', [
      { legend: 'Wraith', games_played: 50, avg_kills: 5, avg_damage: 1500, win_rate: 0.15 },
      { legend: 'Octane', games_played: 30, avg_kills: 4, avg_damage: 1200, win_rate: 0.10 },
      { legend: 'Bangalore', games_played: 20, avg_kills: 2, avg_damage: 600, win_rate: 0.03 },
    ]);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const suggestion = results.find(r => r.type === InsightType.LEGEND_RECOMMENDATION);
    expect(suggestion).toBeDefined();
    expect(suggestion!.severity).toBe(InsightSeverity.SUGGESTION);
    expect(suggestion!.message).toContain('Wraith');
  });

  it('should celebrate when player is on their best legend', () => {
    const ctx = createMockContext('Wraith', [
      { legend: 'Wraith', games_played: 50, avg_kills: 5, avg_damage: 1500, win_rate: 0.15 },
      { legend: 'Octane', games_played: 30, avg_kills: 4, avg_damage: 1200, win_rate: 0.10 },
      { legend: 'Bangalore', games_played: 20, avg_kills: 2, avg_damage: 600, win_rate: 0.03 },
    ]);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const achievement = results.find(r => r.severity === InsightSeverity.ACHIEVEMENT);
    expect(achievement).toBeDefined();
    expect(achievement!.message).toMatch(/best|main/);
  });

  it('should require 5+ games per legend before comparing', () => {
    // All legends have fewer than 5 games -- below MIN_GAMES_FOR_LEGEND_COMPARE
    const ctx = createMockContext('Wraith', []);
    // The query filters by games_played >= threshold, so empty result

    const results = rule.evaluatePostMatch(1, 1, ctx);
    expect(results).toHaveLength(0);
  });

  it('should require 3+ legends with sufficient data', () => {
    // Only 2 legends available -- below MIN_LEGENDS_FOR_COMPARISON
    const ctx = createMockContext('Wraith', [
      { legend: 'Wraith', games_played: 50, avg_kills: 5, avg_damage: 1500, win_rate: 0.15 },
      { legend: 'Octane', games_played: 30, avg_kills: 4, avg_damage: 1200, win_rate: 0.10 },
    ]);

    const results = rule.evaluatePostMatch(1, 1, ctx);
    expect(results).toHaveLength(0);
  });

  it('should return empty when match not found', () => {
    const ctx: RuleContext = {
      query: vi.fn(() => []),
      queryOne: vi.fn(() => undefined), // no match found
    };

    const results = rule.evaluatePostMatch(999, 1, ctx);
    expect(results).toHaveLength(0);
  });
});
