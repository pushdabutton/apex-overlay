// ============================================================
// Weapon Performance Rule -- Unit Tests
// Analyzes kill-feed weapon data to identify top weapons,
// underperforming weapons, and meta alignment.
//
// The rule now runs TWO queries:
//   1. Current session weapon kills (session_id = ?)
//   2. Historical weapon kills (last 20 matches, no session filter)
// It combines both to generate layered insights.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { WeaponPerformanceRule } from '../../src/main/coaching/rules/weapon-performance';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface WeaponKillRow {
  weapon: string;
  kill_count: number;
}

/**
 * Creates a RuleContext mock that returns different data for session vs historical queries.
 * Session query: contains 'session_id' in SQL
 * Historical query: contains 'LIMIT 20' or 'ORDER BY' without 'session_id'
 */
function createDualQueryContext(
  sessionKills: WeaponKillRow[],
  historicalKills: WeaponKillRow[],
): RuleContext {
  return {
    query: vi.fn((sql: string, ...params: unknown[]) => {
      // Session query includes session_id
      if (sql.includes('session_id')) {
        return sessionKills;
      }
      // Historical query does NOT include session_id
      return historicalKills;
    }),
    queryOne: vi.fn(() => undefined),
  };
}

/** Shorthand for single-query context (session only, no historical data) */
function createSessionOnlyContext(weaponKills: WeaponKillRow[]): RuleContext {
  return createDualQueryContext(weaponKills, []);
}

describe('WeaponPerformanceRule', () => {
  const rule = new WeaponPerformanceRule();

  // ------------------------------------------------------------------
  // Dual query structure
  // ------------------------------------------------------------------
  describe('dual query execution', () => {
    it('should execute TWO queries: session-scoped and historical', () => {
      const sessionKills: WeaponKillRow[] = [
        { weapon: 'R-301', kill_count: 5 },
      ];
      const historicalKills: WeaponKillRow[] = [
        { weapon: 'R-301', kill_count: 30 },
        { weapon: 'R-99', kill_count: 25 },
      ];
      const ctx = createDualQueryContext(sessionKills, historicalKills);

      rule.evaluatePostMatch(1, 42, ctx);

      expect(ctx.query).toHaveBeenCalledTimes(2);
    });

    it('should pass sessionId to the session query', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 5 }],
        [{ weapon: 'R-301', kill_count: 20 }],
      );

      rule.evaluatePostMatch(1, 42, ctx);

      const calls = (ctx.query as ReturnType<typeof vi.fn>).mock.calls;
      // Find the session query (contains session_id)
      const sessionCall = calls.find(([sql]: [string]) => sql.includes('session_id'));
      expect(sessionCall).toBeDefined();
      expect(sessionCall![1]).toBe(42);
    });

    it('should use LIMIT 20 in the historical query', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'Wingman', kill_count: 3 }],
        [{ weapon: 'Wingman', kill_count: 15 }],
      );

      rule.evaluatePostMatch(1, 42, ctx);

      const calls = (ctx.query as ReturnType<typeof vi.fn>).mock.calls;
      const histCall = calls.find(([sql]: [string]) => !sql.includes('session_id'));
      expect(histCall).toBeDefined();
      expect(histCall![0]).toMatch(/LIMIT\s+20/i);
    });
  });

  // ------------------------------------------------------------------
  // A) Current session top weapon
  // ------------------------------------------------------------------
  describe('current session top weapon (insight A)', () => {
    it('should report current session top weapon with pct and count', () => {
      const ctx = createDualQueryContext(
        [
          { weapon: 'Wingman', kill_count: 4 },
          { weapon: 'R-301', kill_count: 2 },
        ],
        [
          { weapon: 'R-301', kill_count: 20 },
          { weapon: 'Wingman', kill_count: 10 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const sessionTop = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).sessionTop === true,
      );
      expect(sessionTop).toBeDefined();
      expect(sessionTop!.message).toMatch(/Wingman/);
      expect(sessionTop!.message).toMatch(/67%/); // 4 of 6
      expect(sessionTop!.message).toMatch(/4/);
      expect(sessionTop!.message).toMatch(/6/);
    });
  });

  // ------------------------------------------------------------------
  // B) Historical best weapon context (different from session top)
  // ------------------------------------------------------------------
  describe('historical best weapon context (insight B)', () => {
    it('should mention historical best weapon when different from session top', () => {
      const ctx = createDualQueryContext(
        [
          { weapon: 'Wingman', kill_count: 4 },
          { weapon: 'Peacekeeper', kill_count: 2 },
        ],
        [
          { weapon: 'R-301', kill_count: 30 },
          { weapon: 'Wingman', kill_count: 15 },
          { weapon: 'Peacekeeper', kill_count: 10 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const histBest = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).historicalBest === true,
      );
      expect(histBest).toBeDefined();
      expect(histBest!.message).toMatch(/R-301/);
      expect(histBest!.message).toMatch(/best weapon/i);
    });

    it('should NOT generate historical insight if same weapon as session top', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 5 }],
        [
          { weapon: 'R-301', kill_count: 30 },
          { weapon: 'Wingman', kill_count: 10 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const histBest = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).historicalBest === true,
      );
      expect(histBest).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // C) Session + historical alignment
  // ------------------------------------------------------------------
  describe('session + historical alignment (insight C)', () => {
    it('should generate alignment message when session top = historical top', () => {
      const ctx = createDualQueryContext(
        [
          { weapon: 'R-99', kill_count: 5 },
          { weapon: 'Flatline', kill_count: 2 },
        ],
        [
          { weapon: 'R-99', kill_count: 40 },
          { weapon: 'Flatline', kill_count: 20 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const aligned = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).aligned === true,
      );
      expect(aligned).toBeDefined();
      expect(aligned!.message).toMatch(/R-99/);
      expect(aligned!.message).toMatch(/go-to/i);
      expect(aligned!.message).toMatch(/5/); // session kill count
    });

    it('should NOT generate alignment if historical data is empty', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 6 }],
        [], // no historical data
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const aligned = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).aligned === true,
      );
      expect(aligned).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // D) Meta weapon callout
  // ------------------------------------------------------------------
  describe('meta weapon callout (insight D)', () => {
    it('should note when session top weapon is in the meta', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 6 }],
        [{ weapon: 'Prowler', kill_count: 10 }],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      // Meta callout should be part of the session top message or a separate data flag
      const sessionTop = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).sessionTop === true,
      );
      expect(sessionTop).toBeDefined();
      expect(sessionTop!.message).toMatch(/meta/i);
    });

    it('should note when historical top weapon is in the meta', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'Prowler', kill_count: 5 }], // not meta
        [
          { weapon: 'R-301', kill_count: 30 },  // meta
          { weapon: 'Prowler', kill_count: 15 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const histBest = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).historicalBest === true,
      );
      expect(histBest).toBeDefined();
      expect(histBest!.message).toMatch(/meta/i);
    });
  });

  // ------------------------------------------------------------------
  // E) Underperforming weapon (historical + used this session)
  // ------------------------------------------------------------------
  describe('underperforming weapon (insight E)', () => {
    it('should flag underperforming weapon from historical data if also used this session', () => {
      const ctx = createDualQueryContext(
        [
          { weapon: 'R-301', kill_count: 5 },
          { weapon: 'Sentinel', kill_count: 1 }, // used this session
        ],
        [
          { weapon: 'R-301', kill_count: 40 },
          { weapon: 'Flatline', kill_count: 30 },
          { weapon: 'Wingman', kill_count: 15 },
          { weapon: 'Sentinel', kill_count: 3 }, // historically bad
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const underperforming = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).underperforming === true,
      );
      expect(underperforming).toBeDefined();
      expect(underperforming!.message).toMatch(/Sentinel/);
      expect(underperforming!.severity).toBe(InsightSeverity.SUGGESTION);
    });

    it('should NOT flag underperforming weapon if NOT used this session', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 6 }], // Sentinel NOT used this session
        [
          { weapon: 'R-301', kill_count: 40 },
          { weapon: 'Flatline', kill_count: 30 },
          { weapon: 'Wingman', kill_count: 15 },
          { weapon: 'Sentinel', kill_count: 3 }, // historically bad but not this session
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const underperforming = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).underperforming === true,
      );
      expect(underperforming).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // Max 2 insights limit
  // ------------------------------------------------------------------
  describe('insight limit', () => {
    it('should return at most 2 insights', () => {
      // Setup a scenario that could trigger many: session top + historical best + alignment + meta + underperforming
      const ctx = createDualQueryContext(
        [
          { weapon: 'R-301', kill_count: 5 },
          { weapon: 'Sentinel', kill_count: 1 },
        ],
        [
          { weapon: 'R-99', kill_count: 40 },
          { weapon: 'R-301', kill_count: 30 },
          { weapon: 'Flatline', kill_count: 20 },
          { weapon: 'Sentinel', kill_count: 3 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  // ------------------------------------------------------------------
  // Minimum kills threshold
  // ------------------------------------------------------------------
  describe('minimum kills threshold', () => {
    it('should return empty when session kills below threshold and no historical data', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 2 }], // below WEAPON_MIN_KILLS (5)
        [],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      expect(results).toHaveLength(0);
    });

    it('should still generate insights from historical data even when session kills are low', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-301', kill_count: 2 }], // below threshold
        [
          { weapon: 'R-99', kill_count: 30 },
          { weapon: 'R-301', kill_count: 20 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      // Historical data should still produce insights even with few session kills
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty when BOTH session and historical have zero kills', () => {
      const ctx = createDualQueryContext([], []);

      const results = rule.evaluatePostMatch(1, 1, ctx);

      expect(results).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // Edge cases
  // ------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle session data only (no historical matches)', () => {
      const ctx = createDualQueryContext(
        [
          { weapon: 'Flatline', kill_count: 4 },
          { weapon: 'Peacekeeper', kill_count: 3 },
        ],
        [],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      // Should still get session top weapon insight
      const sessionTop = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).sessionTop === true,
      );
      expect(sessionTop).toBeDefined();
      expect(sessionTop!.message).toMatch(/Flatline/);
    });

    it('should handle historical data only (no session kills)', () => {
      const ctx = createDualQueryContext(
        [], // no session kills
        [
          { weapon: 'R-301', kill_count: 30 },
          { weapon: 'Wingman', kill_count: 20 },
        ],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      // Should mention historical best weapon context
      expect(results.length).toBeGreaterThan(0);
    });

    it('should use INFO severity for session top', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'Flatline', kill_count: 6 }],
        [],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      const sessionTop = results.find(
        (r) => r.data && (r.data as Record<string, unknown>).sessionTop === true,
      );
      expect(sessionTop).toBeDefined();
      expect(sessionTop!.severity).toBe(InsightSeverity.INFO);
    });

    it('should use all WEAPON_PERFORMANCE type', () => {
      const ctx = createDualQueryContext(
        [{ weapon: 'R-99', kill_count: 5 }],
        [{ weapon: 'R-301', kill_count: 30 }],
      );

      const results = rule.evaluatePostMatch(1, 1, ctx);

      for (const r of results) {
        expect(r.type).toBe(InsightType.WEAPON_PERFORMANCE);
      }
    });
  });
});
