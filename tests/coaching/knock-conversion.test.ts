// ============================================================
// Knock-to-Kill Conversion Rule -- Unit Tests
// Detects unfinished fights by comparing knockdowns to kills.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { KnockConversionRule } from '../../src/main/coaching/rules/knock-conversion';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface MatchStatsRow {
  kills: number;
  knockdowns: number;
}

function createKnockContext(matchStats: MatchStatsRow | undefined): RuleContext {
  return {
    query: vi.fn(() => []),
    queryOne: vi.fn((sql: string) => {
      if (sql.includes('matches') && sql.includes('knockdowns')) {
        return matchStats;
      }
      return undefined;
    }),
  };
}

describe('KnockConversionRule', () => {
  const rule = new KnockConversionRule();

  it('should give achievement for perfect finishing (ratio <= 1.2)', () => {
    const ctx = createKnockContext({ knockdowns: 3, kills: 3 }); // ratio 1.0
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.KNOCK_CONVERSION);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    expect(insight!.message).toMatch(/3 knocks/);
    expect(insight!.message).toMatch(/3 kills/);
  });

  it('should give info for normal ratio (1.2-1.5)', () => {
    const ctx = createKnockContext({ knockdowns: 4, kills: 3 }); // ratio 1.33
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.KNOCK_CONVERSION);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.INFO);
  });

  it('should give suggestion for poor finishing (1.5-2.0)', () => {
    const ctx = createKnockContext({ knockdowns: 6, kills: 3 }); // ratio 2.0
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.KNOCK_CONVERSION);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.SUGGESTION);
    expect(insight!.message).toMatch(/6/);
    expect(insight!.message).toMatch(/3/);
    expect(insight!.message).toMatch(/thirst/i);
  });

  it('should give warning for very poor finishing (> 2.0)', () => {
    const ctx = createKnockContext({ knockdowns: 8, kills: 2 }); // ratio 4.0
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.KNOCK_CONVERSION);
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe(InsightSeverity.WARNING);
    expect(insight!.message).toMatch(/8/);
    expect(insight!.message).toMatch(/2/);
    expect(insight!.message).toMatch(/finish/i);
  });

  it('should return no insight when both knockdowns and kills are 0', () => {
    const ctx = createKnockContext({ knockdowns: 0, kills: 0 });
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.KNOCK_CONVERSION);
    expect(insight).toBeUndefined();
  });

  it('should give cleanup kills message when 0 knocks but kills > 0', () => {
    const ctx = createKnockContext({ knockdowns: 0, kills: 3 });
    const results = rule.evaluatePostMatch(1, 1, ctx);

    const insight = results.find((r) => r.type === InsightType.KNOCK_CONVERSION);
    expect(insight).toBeDefined();
    expect(insight!.message).toMatch(/cleanup/i);
    expect(insight!.message).toMatch(/initiat/i);
  });
});
