// ============================================================
// Enhanced Legend Recommendation Rule -- Unit Tests
// Tests K/D-based switch suggestions, main celebration,
// underplayed legend discovery, single-legend players.
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

describe('LegendRecommendationRule (Enhanced)', () => {
  const rule = new LegendRecommendationRule();

  it('should recommend switching when current legend K/D is 25%+ below best legend', () => {
    const ctx = createMockContext('Bangalore', [
      { legend: 'Horizon', games_played: 40, avg_kills: 4.5, avg_damage: 1400, win_rate: 0.12 },
      { legend: 'Wraith', games_played: 30, avg_kills: 3.8, avg_damage: 1100, win_rate: 0.10 },
      { legend: 'Bangalore', games_played: 20, avg_kills: 2.0, avg_damage: 600, win_rate: 0.03 },
    ]);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const suggestion = results.find(
      (r) => r.type === InsightType.LEGEND_RECOMMENDATION && r.severity === InsightSeverity.SUGGESTION,
    );
    expect(suggestion).toBeDefined();
    expect(suggestion!.message).toContain('Horizon');
  });

  it('should celebrate when playing best legend', () => {
    const ctx = createMockContext('Horizon', [
      { legend: 'Horizon', games_played: 40, avg_kills: 4.5, avg_damage: 1400, win_rate: 0.12 },
      { legend: 'Wraith', games_played: 30, avg_kills: 3.8, avg_damage: 1100, win_rate: 0.10 },
      { legend: 'Bangalore', games_played: 20, avg_kills: 2.0, avg_damage: 600, win_rate: 0.03 },
    ]);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const celebration = results.find(
      (r) => r.severity === InsightSeverity.ACHIEVEMENT,
    );
    expect(celebration).toBeDefined();
    expect(celebration!.message).toMatch(/best|main/i);
  });

  it('should suggest trying underplayed legends with good stats', () => {
    // Catalyst has only 5 games but 30% win rate -- returned by underplayed query
    const mainLegends = [
      { legend: 'Wraith', games_played: 100, avg_kills: 3.5, avg_damage: 1000, win_rate: 0.10 },
      { legend: 'Octane', games_played: 50, avg_kills: 3.0, avg_damage: 900, win_rate: 0.08 },
      { legend: 'Bangalore', games_played: 30, avg_kills: 2.5, avg_damage: 800, win_rate: 0.06 },
    ];

    const underplayedLegends = [
      { legend: 'Catalyst', games_played: 5, avg_kills: 4.0, avg_damage: 1200, win_rate: 0.30 },
    ];

    const ctx = createMockContext('Wraith', mainLegends, underplayedLegends);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const underplayed = results.find(
      (r) => r.data && (r.data as Record<string, unknown>).underplayed === true,
    );
    expect(underplayed).toBeDefined();
    expect(underplayed!.message).toMatch(/Catalyst/);
    expect(underplayed!.severity).toBe(InsightSeverity.SUGGESTION);
  });

  it('should handle single-legend players by suggesting branching out', () => {
    // Only 1 legend with enough games
    const ctx = createMockContext('Wraith', [
      { legend: 'Wraith', games_played: 50, avg_kills: 3.5, avg_damage: 1000, win_rate: 0.10 },
    ]);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    // Should not crash; may suggest branching out
    const branchOut = results.find(
      (r) => r.data && (r.data as Record<string, unknown>).singleLegend === true,
    );
    expect(branchOut).toBeDefined();
    expect(branchOut!.message).toMatch(/branch|try|experiment/i);
  });
});
