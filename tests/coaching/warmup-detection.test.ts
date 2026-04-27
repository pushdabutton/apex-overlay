// ============================================================
// Warm-Up Detection Rule -- Unit Tests
// Detects if the player performs poorly at session start.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { WarmUpDetectionRule } from '../../src/main/coaching/rules/warmup-detection';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface SessionWithMatches {
  id: number;
  matches_played: number;
}

interface MatchRow {
  session_id: number;
  damage: number;
  kills: number;
  row_num: number;
}

function createWarmupContext(
  sessions: SessionWithMatches[],
  matchesBySession: Record<number, MatchRow[]>,
): RuleContext {
  return {
    query: vi.fn((sql: string, ...params: unknown[]) => {
      if (sql.includes('sessions') && sql.includes('matches_played')) {
        return sessions;
      }
      if (sql.includes('ROW_NUMBER') || sql.includes('matches') && sql.includes('session_id')) {
        const sessionId = params[0] as number;
        return matchesBySession[sessionId] ?? [];
      }
      // Fallback: return all matches for the requested session
      const sid = params[0] as number;
      return matchesBySession[sid] ?? [];
    }),
    queryOne: vi.fn(() => undefined),
  };
}

describe('WarmUpDetectionRule', () => {
  const rule = new WarmUpDetectionRule();

  it('should detect warm-up pattern when first 2 games avg 40% less damage', () => {
    // 5 sessions each with 4+ matches
    // In each session, first 2 games have ~400 damage, remaining have ~800
    const sessions = [
      { id: 1, matches_played: 4 },
      { id: 2, matches_played: 4 },
      { id: 3, matches_played: 4 },
      { id: 4, matches_played: 4 },
      { id: 5, matches_played: 4 },
    ];

    const matchesBySession: Record<number, MatchRow[]> = {};
    for (const s of sessions) {
      matchesBySession[s.id] = [
        { session_id: s.id, damage: 350, kills: 1, row_num: 1 },
        { session_id: s.id, damage: 400, kills: 1, row_num: 2 },
        { session_id: s.id, damage: 800, kills: 3, row_num: 3 },
        { session_id: s.id, damage: 850, kills: 4, row_num: 4 },
      ];
    }

    const ctx = createWarmupContext(sessions, matchesBySession);
    const results = rule.evaluateSession(5, ctx);

    const warmup = results.find((r) => r.type === InsightType.WARM_UP_PATTERN);
    expect(warmup).toBeDefined();
    expect(warmup!.severity).toBe(InsightSeverity.SUGGESTION);
    expect(warmup!.message).toMatch(/first.*game|warm.?up|aim train/i);
  });

  it('should report no warm-up pattern when first games are consistent', () => {
    // 5 sessions, all games have similar damage
    const sessions = [
      { id: 1, matches_played: 4 },
      { id: 2, matches_played: 4 },
      { id: 3, matches_played: 4 },
      { id: 4, matches_played: 4 },
      { id: 5, matches_played: 4 },
    ];

    const matchesBySession: Record<number, MatchRow[]> = {};
    for (const s of sessions) {
      matchesBySession[s.id] = [
        { session_id: s.id, damage: 780, kills: 3, row_num: 1 },
        { session_id: s.id, damage: 820, kills: 3, row_num: 2 },
        { session_id: s.id, damage: 800, kills: 3, row_num: 3 },
        { session_id: s.id, damage: 810, kills: 3, row_num: 4 },
      ];
    }

    const ctx = createWarmupContext(sessions, matchesBySession);
    const results = rule.evaluateSession(5, ctx);

    const warmup = results.find((r) => r.type === InsightType.WARM_UP_PATTERN);
    // Should either be absent or explicitly say "no warm-up pattern"
    if (warmup) {
      expect(warmup.message).toMatch(/start strong|consistent/i);
      expect(warmup.severity).toBe(InsightSeverity.ACHIEVEMENT);
    }
  });

  it('should require minimum 5 sessions with 3+ matches each', () => {
    // Only 3 sessions
    const sessions = [
      { id: 1, matches_played: 4 },
      { id: 2, matches_played: 4 },
      { id: 3, matches_played: 4 },
    ];

    const matchesBySession: Record<number, MatchRow[]> = {};
    for (const s of sessions) {
      matchesBySession[s.id] = [
        { session_id: s.id, damage: 350, kills: 1, row_num: 1 },
        { session_id: s.id, damage: 400, kills: 1, row_num: 2 },
        { session_id: s.id, damage: 800, kills: 3, row_num: 3 },
        { session_id: s.id, damage: 850, kills: 4, row_num: 4 },
      ];
    }

    const ctx = createWarmupContext(sessions, matchesBySession);
    const results = rule.evaluateSession(3, ctx);

    expect(results).toHaveLength(0);
  });
});
