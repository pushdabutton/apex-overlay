// ============================================================
// Tilt Detection Rule -- Unit Tests
// Detects consecutive ranked losses (tilt) and win streaks.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { TiltDetectionRule } from '../../src/main/coaching/rules/tilt-detection';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface RankedMatchRow {
  rp_change: number;
  mode: string;
}

function createTiltContext(rankedMatches: RankedMatchRow[]): RuleContext {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('rp_change') && sql.includes('ranked')) {
        return rankedMatches;
      }
      return [];
    }),
    queryOne: vi.fn(() => undefined),
  };
}

describe('TiltDetectionRule', () => {
  const rule = new TiltDetectionRule();

  it('should trigger suggestion after 3 consecutive ranked losses', () => {
    // Most recent first
    const matches: RankedMatchRow[] = [
      { rp_change: -20, mode: 'ranked' },
      { rp_change: -15, mode: 'ranked' },
      { rp_change: -25, mode: 'ranked' },
      { rp_change: 30, mode: 'ranked' },  // older, positive
      { rp_change: 40, mode: 'ranked' },
    ];
    const ctx = createTiltContext(matches);
    const results = rule.evaluateSession(1, ctx);

    const tiltInsight = results.find((r) => r.type === InsightType.TILT_WARNING);
    expect(tiltInsight).toBeDefined();
    expect(tiltInsight!.severity).toBe(InsightSeverity.SUGGESTION);
    expect(tiltInsight!.message).toMatch(/3/);
    expect(tiltInsight!.message).toMatch(/break/i);
  });

  it('should trigger warning after 5 consecutive ranked losses with total RP', () => {
    const matches: RankedMatchRow[] = [
      { rp_change: -20, mode: 'ranked' },
      { rp_change: -15, mode: 'ranked' },
      { rp_change: -25, mode: 'ranked' },
      { rp_change: -30, mode: 'ranked' },
      { rp_change: -10, mode: 'ranked' },
      { rp_change: 40, mode: 'ranked' },  // older, positive
    ];
    const ctx = createTiltContext(matches);
    const results = rule.evaluateSession(1, ctx);

    const tiltInsight = results.find((r) => r.type === InsightType.TILT_WARNING);
    expect(tiltInsight).toBeDefined();
    expect(tiltInsight!.severity).toBe(InsightSeverity.WARNING);
    expect(tiltInsight!.message).toMatch(/5/);
    expect(tiltInsight!.message).toMatch(/-100/);
    expect(tiltInsight!.message).toMatch(/break/i);
  });

  it('should trigger achievement for 3+ consecutive wins', () => {
    const matches: RankedMatchRow[] = [
      { rp_change: 50, mode: 'ranked' },
      { rp_change: 40, mode: 'ranked' },
      { rp_change: 35, mode: 'ranked' },
      { rp_change: -10, mode: 'ranked' },  // older, loss
    ];
    const ctx = createTiltContext(matches);
    const results = rule.evaluateSession(1, ctx);

    const winInsight = results.find((r) => r.type === InsightType.WIN_STREAK);
    expect(winInsight).toBeDefined();
    expect(winInsight!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    expect(winInsight!.message).toMatch(/3/);
    expect(winInsight!.message).toMatch(/\+125/);
  });

  it('should trigger nothing for mixed results (WLLWL)', () => {
    const matches: RankedMatchRow[] = [
      { rp_change: -20, mode: 'ranked' },
      { rp_change: 30, mode: 'ranked' },
      { rp_change: -15, mode: 'ranked' },
      { rp_change: -10, mode: 'ranked' },
      { rp_change: 40, mode: 'ranked' },
    ];
    const ctx = createTiltContext(matches);
    const results = rule.evaluateSession(1, ctx);

    // No tilt or streak insights
    const tilt = results.find((r) => r.type === InsightType.TILT_WARNING);
    const streak = results.find((r) => r.type === InsightType.WIN_STREAK);
    expect(tilt).toBeUndefined();
    expect(streak).toBeUndefined();
  });

  it('should ignore non-ranked matches', () => {
    // Only ranked matches should be considered -- non-ranked filtered by query
    const matches: RankedMatchRow[] = [
      { rp_change: -20, mode: 'ranked' },
      { rp_change: -15, mode: 'ranked' },
      // Only 2 ranked losses -- not enough for tilt
    ];
    const ctx = createTiltContext(matches);
    const results = rule.evaluateSession(1, ctx);

    const tilt = results.find((r) => r.type === InsightType.TILT_WARNING);
    expect(tilt).toBeUndefined();
  });

  it('should return nothing with insufficient data (< 3 matches)', () => {
    const matches: RankedMatchRow[] = [
      { rp_change: -20, mode: 'ranked' },
      { rp_change: -15, mode: 'ranked' },
    ];
    const ctx = createTiltContext(matches);
    const results = rule.evaluateSession(1, ctx);

    expect(results).toHaveLength(0);
  });
});
