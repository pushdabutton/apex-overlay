// ============================================================
// Enhanced Trend Detection Rule -- Unit Tests
// Tests improving/declining/plateau trends over 5+ sessions
// with actionable advice.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { TrendDetectionRule } from '../../src/main/coaching/rules/trend-detection';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

function createMockContext(
  sessions: Array<{
    id: number;
    total_kills: number;
    total_damage: number;
    total_headshots: number;
    matches_played: number;
  }>,
): RuleContext {
  return {
    query: vi.fn(() => sessions),
    queryOne: vi.fn(() => undefined),
  };
}

describe('TrendDetectionRule (Enhanced)', () => {
  const rule = new TrendDetectionRule();

  it('should detect improving trend over 5+ sessions with percentage', () => {
    // 5 sessions with steadily improving damage
    // Most recent first
    const sessions = [
      { id: 5, total_kills: 15, total_damage: 4000, total_headshots: 5, matches_played: 5 },
      { id: 4, total_kills: 12, total_damage: 3200, total_headshots: 4, matches_played: 5 },
      { id: 3, total_kills: 10, total_damage: 2800, total_headshots: 3, matches_played: 5 },
      { id: 2, total_kills: 8, total_damage: 2000, total_headshots: 2, matches_played: 5 },
      { id: 1, total_kills: 5, total_damage: 1200, total_headshots: 1, matches_played: 5 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(5, ctx);

    const improving = results.find((r) => r.type === InsightType.TREND_IMPROVING);
    expect(improving).toBeDefined();
    expect(improving!.severity).toBe(InsightSeverity.ACHIEVEMENT);
    // Should mention "improved" and a percentage or delta
    expect(improving!.message).toMatch(/improv/i);
    expect(improving!.data).toBeDefined();
  });

  it('should detect declining trend with actionable advice', () => {
    // 5 sessions with steadily declining headshot rate
    const sessions = [
      { id: 5, total_kills: 5, total_damage: 1200, total_headshots: 2, matches_played: 5 },
      { id: 4, total_kills: 8, total_damage: 2000, total_headshots: 5, matches_played: 5 },
      { id: 3, total_kills: 10, total_damage: 2800, total_headshots: 8, matches_played: 5 },
      { id: 2, total_kills: 12, total_damage: 3200, total_headshots: 12, matches_played: 5 },
      { id: 1, total_kills: 15, total_damage: 4000, total_headshots: 15, matches_played: 5 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(5, ctx);

    const declining = results.find((r) => r.type === InsightType.TREND_DECLINING);
    expect(declining).toBeDefined();
    expect(declining!.severity).toBe(InsightSeverity.WARNING);
    expect(declining!.message).toMatch(/declin/i);
  });

  it('should identify plateau when stats are consistent over 5+ sessions', () => {
    // 5 sessions with very similar avg damage (~650)
    const sessions = [
      { id: 5, total_kills: 6, total_damage: 3250, total_headshots: 3, matches_played: 5 },
      { id: 4, total_kills: 7, total_damage: 3300, total_headshots: 3, matches_played: 5 },
      { id: 3, total_kills: 6, total_damage: 3200, total_headshots: 2, matches_played: 5 },
      { id: 2, total_kills: 7, total_damage: 3350, total_headshots: 3, matches_played: 5 },
      { id: 1, total_kills: 6, total_damage: 3150, total_headshots: 3, matches_played: 5 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(5, ctx);

    const plateau = results.find((r) => r.type === InsightType.TREND_PLATEAU);
    expect(plateau).toBeDefined();
    expect(plateau!.severity).toBe(InsightSeverity.INFO);
    expect(plateau!.message).toMatch(/consistent|plateau|stable/i);
  });

  it('should provide actionable advice based on trend type', () => {
    // Declining trend should include advice
    const sessions = [
      { id: 4, total_kills: 2, total_damage: 400, total_headshots: 0, matches_played: 4 },
      { id: 3, total_kills: 4, total_damage: 800, total_headshots: 1, matches_played: 4 },
      { id: 2, total_kills: 6, total_damage: 1200, total_headshots: 2, matches_played: 4 },
      { id: 1, total_kills: 8, total_damage: 2000, total_headshots: 3, matches_played: 4 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(4, ctx);

    const declining = results.find((r) => r.type === InsightType.TREND_DECLINING);
    expect(declining).toBeDefined();
    // Should contain some actionable advice
    expect(declining!.message.length).toBeGreaterThan(30);
  });

  it('should require minimum 3 sessions before generating trends', () => {
    const sessions = [
      { id: 2, total_kills: 10, total_damage: 3000, total_headshots: 5, matches_played: 5 },
      { id: 1, total_kills: 2, total_damage: 500, total_headshots: 0, matches_played: 5 },
    ];
    const ctx = createMockContext(sessions);

    const results = rule.evaluateSession(2, ctx);
    expect(results).toHaveLength(0);
  });
});
