// ============================================================
// Trend Detection Rule -- Unit Tests
// Tests that the rule detects improving/declining trends
// over 3+ sessions and reports appropriately.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { TrendDetectionRule } from '../../src/main/coaching/rules/trend-detection';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

function createMockContext(sessions: Array<{
  id: number;
  total_kills: number;
  total_damage: number;
  total_headshots: number;
  matches_played: number;
}>): RuleContext {
  return {
    query: vi.fn(() => sessions),
    queryOne: vi.fn(() => undefined),
  };
}

describe('TrendDetectionRule', () => {
  const rule = new TrendDetectionRule();

  it('should detect improving trend over 3+ sessions', () => {
    // Most recent first: sessions with increasing avg damage
    // Session 1: 2000/4 = 500 avg
    // Session 2: 1200/4 = 300 avg
    // Session 3: 800/4  = 200 avg
    // Session 4: 400/4  = 100 avg
    // Most recent has highest => improving
    const sessions = [
      { id: 4, total_kills: 8, total_damage: 2000, total_headshots: 3, matches_played: 4 },
      { id: 3, total_kills: 6, total_damage: 1200, total_headshots: 2, matches_played: 4 },
      { id: 2, total_kills: 4, total_damage: 800, total_headshots: 1, matches_played: 4 },
      { id: 1, total_kills: 2, total_damage: 400, total_headshots: 0, matches_played: 4 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(4, ctx);

    const improving = results.find(r => r.type === InsightType.TREND_IMPROVING);
    expect(improving).toBeDefined();
    expect(improving!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    expect(improving!.data?.metric).toBe('damage');
  });

  it('should detect declining trend over 3+ sessions', () => {
    // Most recent first: sessions with decreasing avg damage
    const sessions = [
      { id: 4, total_kills: 2, total_damage: 400, total_headshots: 0, matches_played: 4 },
      { id: 3, total_kills: 4, total_damage: 800, total_headshots: 1, matches_played: 4 },
      { id: 2, total_kills: 6, total_damage: 1200, total_headshots: 2, matches_played: 4 },
      { id: 1, total_kills: 8, total_damage: 2000, total_headshots: 3, matches_played: 4 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(4, ctx);

    const declining = results.find(r => r.type === InsightType.TREND_DECLINING);
    expect(declining).toBeDefined();
    expect(declining!.severity).toBe(InsightSeverity.WARNING);
  });

  it('should return flat for mixed session trends', () => {
    // Zigzag pattern -- no clear direction
    const sessions = [
      { id: 4, total_kills: 5, total_damage: 1000, total_headshots: 2, matches_played: 4 },
      { id: 3, total_kills: 8, total_damage: 2000, total_headshots: 3, matches_played: 4 },
      { id: 2, total_kills: 3, total_damage: 600, total_headshots: 1, matches_played: 4 },
      { id: 1, total_kills: 7, total_damage: 1800, total_headshots: 2, matches_played: 4 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(4, ctx);

    // Should find no improving/declining -- only flat
    expect(results).toHaveLength(0);
  });

  it('should require minimum 3 sessions with matches', () => {
    // Only 2 sessions
    const sessions = [
      { id: 2, total_kills: 10, total_damage: 3000, total_headshots: 5, matches_played: 5 },
      { id: 1, total_kills: 2, total_damage: 500, total_headshots: 0, matches_played: 5 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(2, ctx);
    expect(results).toHaveLength(0);
  });

  it('should handle sessions with 0 matches played gracefully', () => {
    // matches_played is 0 for one session -- Math.max(0,1) should prevent division by zero
    const sessions = [
      { id: 3, total_kills: 6, total_damage: 1500, total_headshots: 2, matches_played: 3 },
      { id: 2, total_kills: 0, total_damage: 0, total_headshots: 0, matches_played: 0 },
      { id: 1, total_kills: 4, total_damage: 1000, total_headshots: 1, matches_played: 3 },
    ];
    const ctx = createMockContext(sessions);

    // Should not throw
    const results = rule.evaluateSession(3, ctx);
    expect(results).toBeDefined();
  });
});
