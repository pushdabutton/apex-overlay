// ============================================================
// Ranked Progress Rule -- Unit Tests
// Tracks ranked progress, RP trajectory, demotion risk,
// rank milestones, and games-to-next-rank projection.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { RankedProgressRule } from '../../src/main/coaching/rules/ranked-progress';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface RankedMatchRow {
  rp_change: number;
  placement: number;
}

interface PlayerRankRow {
  rank_name: string;
  rank_score: number;
}

function createRankedContext(
  rankedMatches: RankedMatchRow[],
  playerRank?: PlayerRankRow,
  matchMode?: string,
): RuleContext {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('rp_change') && sql.includes('ranked')) {
        return rankedMatches;
      }
      return [];
    }),
    queryOne: vi.fn((sql: string) => {
      if (sql.includes('player_profile') || sql.includes('rank')) {
        return playerRank;
      }
      if (sql.includes('mode') && sql.includes('matches')) {
        return { mode: matchMode ?? 'ranked' };
      }
      return undefined;
    }),
  };
}

describe('RankedProgressRule', () => {
  const rule = new RankedProgressRule();

  it('should calculate games needed to reach next rank tier', () => {
    // Player at Gold IV (5600 RP), needs to reach Gold III (6250 RP)
    // Average RP gain: +40 per game => 650/40 = ~17 games
    // In-game calibrated: Gold IV = 5500-6249 (750 RP per division)
    const rankedMatches = [
      { rp_change: 50, placement: 5 },
      { rp_change: 30, placement: 8 },
      { rp_change: 40, placement: 6 },
      { rp_change: 45, placement: 4 },
      { rp_change: 35, placement: 7 },
    ];
    const playerRank = { rank_name: 'Gold IV', rank_score: 5600 };
    const ctx = createRankedContext(rankedMatches, playerRank);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const projection = results.find(
      (r) => r.type === InsightType.RANKED_MILESTONE,
    );
    expect(projection).toBeDefined();
    expect(projection!.message).toMatch(/game|pace/i);
    expect(projection!.data).toBeDefined();
  });

  it('should detect RP gain/loss trend', () => {
    // 5 ranked games with positive RP trend
    // In-game calibrated: Platinum III = 9375-10249 (875 RP per division)
    const rankedMatches = [
      { rp_change: 60, placement: 3 },
      { rp_change: 50, placement: 5 },
      { rp_change: 40, placement: 6 },
      { rp_change: 55, placement: 4 },
      { rp_change: 45, placement: 5 },
    ];
    const playerRank = { rank_name: 'Platinum III', rank_score: 9500 };
    const ctx = createRankedContext(rankedMatches, playerRank);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const rpTrend = results.find(
      (r) => r.type === InsightType.RANKED_MILESTONE && r.data && (r.data as Record<string, unknown>).totalRpChange !== undefined,
    );
    expect(rpTrend).toBeDefined();
    expect((rpTrend!.data as Record<string, unknown>).totalRpChange).toBeGreaterThan(0);
  });

  it('should warn about demotion risk when close to tier floor', () => {
    // Player at Gold III with 6270 RP (floor is 6250 for Gold III), only 20 RP above
    // In-game calibrated: Gold III = 6250-6999 (750 RP per division)
    // Recent games have negative RP
    const rankedMatches = [
      { rp_change: -20, placement: 15 },
      { rp_change: -15, placement: 14 },
      { rp_change: -25, placement: 17 },
      { rp_change: -10, placement: 12 },
      { rp_change: -30, placement: 18 },
    ];
    const playerRank = { rank_name: 'Gold III', rank_score: 6270 };
    const ctx = createRankedContext(rankedMatches, playerRank);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const demotionWarn = results.find(
      (r) => r.severity === InsightSeverity.WARNING && r.data && (r.data as Record<string, unknown>).demotionRisk === true,
    );
    expect(demotionWarn).toBeDefined();
    expect(demotionWarn!.message).toMatch(/demotion|careful/i);
  });

  it('should celebrate rank milestones', () => {
    // Player just crossed into Diamond IV (score just above threshold at 12000)
    // In-game calibrated: Diamond IV = 12000-12999 (1000 RP per division)
    const rankedMatches = [
      { rp_change: 60, placement: 2 },
      { rp_change: 50, placement: 3 },
      { rp_change: 40, placement: 5 },
    ];
    const playerRank = { rank_name: 'Diamond IV', rank_score: 12050 };
    const ctx = createRankedContext(rankedMatches, playerRank);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const milestone = results.find(
      (r) => r.severity === InsightSeverity.ACHIEVEMENT && r.type === InsightType.RANKED_MILESTONE,
    );
    expect(milestone).toBeDefined();
    expect(milestone!.message).toMatch(/Diamond/i);
  });
});
