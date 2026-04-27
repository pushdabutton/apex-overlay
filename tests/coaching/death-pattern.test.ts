// ============================================================
// Death Pattern Analysis Rule -- Unit Tests
// Analyzes WHEN the player dies (early/mid/late game),
// detects late-game chokes, and calculates survival rates.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { DeathTimingRule } from '../../src/main/coaching/rules/death-timing';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

function createDeathContext(
  deaths: Array<{ survival_time: number }>,
  recentMatches?: Array<{ placement: number; survival_time: number; deaths: number }>,
): RuleContext {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('placement') && sql.includes('survival_time') && sql.includes('deaths')) {
        return recentMatches ?? [];
      }
      // Default: return death timing rows
      return deaths;
    }),
    queryOne: vi.fn(() => undefined),
  };
}

describe('DeathTimingRule (Death Pattern Analysis)', () => {
  const rule = new DeathTimingRule();

  it('should detect early-game deaths when 60%+ die in first 2 minutes', () => {
    // 10 deaths, 7 in first 120 seconds
    const deaths = [
      { survival_time: 30 },
      { survival_time: 45 },
      { survival_time: 60 },
      { survival_time: 90 },
      { survival_time: 100 },
      { survival_time: 110 },
      { survival_time: 120 },
      { survival_time: 400 },
      { survival_time: 500 },
      { survival_time: 700 },
    ];
    const ctx = createDeathContext(deaths);

    const results = rule.evaluateSession(1, ctx);

    const earlyDeath = results.find((r) => r.type === InsightType.DEATH_TIMING);
    expect(earlyDeath).toBeDefined();
    expect(earlyDeath!.severity).toBe(InsightSeverity.SUGGESTION);
    expect(earlyDeath!.message).toMatch(/first.*minute|early|landing/i);
  });

  it('should detect late-game chokes (top 5 but rarely win)', () => {
    // Player consistently makes top 5 but rarely wins
    const deaths = [
      { survival_time: 800 },
      { survival_time: 850 },
      { survival_time: 900 },
      { survival_time: 750 },
      { survival_time: 820 },
      { survival_time: 810 },
      { survival_time: 780 },
      { survival_time: 860 },
      { survival_time: 890 },
      { survival_time: 770 },
    ];

    const recentMatches = [
      { placement: 3, survival_time: 800, deaths: 1 },
      { placement: 4, survival_time: 850, deaths: 1 },
      { placement: 2, survival_time: 900, deaths: 1 },
      { placement: 5, survival_time: 750, deaths: 1 },
      { placement: 3, survival_time: 820, deaths: 1 },
      { placement: 4, survival_time: 810, deaths: 1 },
      { placement: 5, survival_time: 780, deaths: 1 },
      { placement: 2, survival_time: 860, deaths: 1 },
      { placement: 3, survival_time: 890, deaths: 1 },
      { placement: 4, survival_time: 770, deaths: 1 },
    ];

    const ctx = createDeathContext(deaths, recentMatches);

    const results = rule.evaluateSession(1, ctx);

    const lateGame = results.find(
      (r) => r.type === InsightType.DEATH_TIMING,
    );
    expect(lateGame).toBeDefined();
    expect(lateGame!.message).toMatch(/endgame|late|final.*ring|position/i);
  });

  it('should calculate survival rate per game phase', () => {
    const deaths = [
      { survival_time: 60 },   // early
      { survival_time: 90 },   // early
      { survival_time: 300 },  // mid
      { survival_time: 400 },  // mid
      { survival_time: 500 },  // mid
      { survival_time: 700 },  // late
      { survival_time: 800 },  // late
      { survival_time: 850 },  // late
      { survival_time: 900 },  // late
      { survival_time: 950 },  // late
    ];
    const ctx = createDeathContext(deaths);

    const results = rule.evaluateSession(1, ctx);

    // All results should have data with phase breakdown
    for (const r of results) {
      if (r.type === InsightType.DEATH_TIMING && r.data) {
        const data = r.data as Record<string, unknown>;
        expect(data).toHaveProperty('earlyPct');
        expect(data).toHaveProperty('midPct');
        expect(data).toHaveProperty('latePct');
      }
    }
  });

  it('should provide phase-specific advice', () => {
    // Mostly early deaths
    const deaths = Array(12).fill(null).map((_, i) =>
      i < 8 ? { survival_time: 60 + i * 10 } : { survival_time: 600 + i * 100 },
    );
    const ctx = createDeathContext(deaths);

    const results = rule.evaluateSession(1, ctx);

    const earlyInsight = results.find((r) => r.type === InsightType.DEATH_TIMING);
    expect(earlyInsight).toBeDefined();
    // Should contain specific early-game advice
    expect(earlyInsight!.message).toMatch(/land|loot|contest|safer/i);
  });
});
