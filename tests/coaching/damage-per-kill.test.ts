// ============================================================
// Damage Per Kill Rule -- Unit Tests
// THE differentiator: no competitor provides this metric.
// Computes damage/kills ratio and coaches based on benchmarks.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { DamagePerKillRule } from '../../src/main/coaching/rules/damage-per-kill';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface MatchStatsRow {
  kills: number;
  damage: number;
}

interface SessionAvgRow {
  avg_dpk: number;
}

interface HistoricalAvgRow {
  avg_dpk: number;
}

function createDpkContext(
  matchStats: MatchStatsRow | undefined,
  sessionAvg?: SessionAvgRow,
  historicalAvg?: HistoricalAvgRow,
): RuleContext {
  return {
    query: vi.fn(() => []),
    queryOne: vi.fn((sql: string) => {
      if (sql.includes('matches') && sql.includes('kills') && sql.includes('damage') && !sql.includes('AVG')) {
        return matchStats;
      }
      if (sql.includes('AVG') && sql.includes('session')) {
        return sessionAvg;
      }
      if (sql.includes('AVG') && !sql.includes('session')) {
        return historicalAvg;
      }
      return undefined;
    }),
  };
}

describe('DamagePerKillRule', () => {
  const rule = new DamagePerKillRule();

  it('should give achievement for clean fragger (< 200 DPK)', () => {
    const ctx = createDpkContext({ kills: 8, damage: 1400 }); // 175 DPK
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.DAMAGE_PER_KILL);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    expect(insight!.message).toMatch(/clean/i);
    expect(insight!.message).toMatch(/175/);
  });

  it('should give info for normal player (200-350 DPK)', () => {
    const ctx = createDpkContext({ kills: 5, damage: 1500 }); // 300 DPK
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.DAMAGE_PER_KILL);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.INFO);
    expect(insight!.message).toMatch(/300/);
  });

  it('should give suggestion for poke-heavy player (350-500 DPK)', () => {
    const ctx = createDpkContext({ kills: 4, damage: 1800 }); // 450 DPK
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.DAMAGE_PER_KILL);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.SUGGESTION);
    expect(insight!.message).toMatch(/450/);
    expect(insight!.message).toMatch(/finish/i);
  });

  it('should give warning for damage farmer (500+ DPK)', () => {
    const ctx = createDpkContext({ kills: 3, damage: 2100 }); // 700 DPK
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.DAMAGE_PER_KILL);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.WARNING);
    expect(insight!.message).toMatch(/700/);
    expect(insight!.message).toMatch(/pok/i);
  });

  it('should return no insight when kills is 0 (no division by zero)', () => {
    const ctx = createDpkContext({ kills: 0, damage: 500 });
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.DAMAGE_PER_KILL);
    expect(insight).toBeUndefined();
  });

  it('should compare session average DPK to 7-day historical trend', () => {
    const ctx = createDpkContext(
      { kills: 5, damage: 1500 }, // 300 DPK this match
      { avg_dpk: 320 },          // session average
      { avg_dpk: 280 },          // 7-day historical average
    );
    const results = rule.evaluatePostMatch(1, 1, ctx);

    // Should include session comparison data
    const sessionInsight = results.find(
      (r) => r.type === InsightType.DAMAGE_PER_KILL && r.data && (r.data as Record<string, unknown>).sessionAvgDpk !== undefined,
    );
    expect(sessionInsight).toBeDefined();
  });
});
