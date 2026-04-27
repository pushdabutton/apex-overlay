// ============================================================
// Ranked Progress Rule
// Tracks ranked RP trajectory, projects games to next rank,
// detects demotion risk, and celebrates milestones.
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS, RANK_TIERS } from '../../../shared/constants';

interface RankedMatchRow {
  rp_change: number;
  placement: number;
}

interface PlayerRankRow {
  rank_name: string;
  rank_score: number;
}

interface MatchModeRow {
  mode: string;
}

/**
 * Get the RP threshold for a given rank name.
 * E.g., "Gold IV" -> 4000 (start of Gold tier)
 * Returns { floorRP, ceilRP, tierName, division }
 */
function getRankInfo(rankName: string): {
  floorRP: number;
  ceilRP: number;
  tierName: string;
  division: number;
  nextRankName: string;
  nextRankRP: number;
} | null {
  // Parse rank name: "Gold IV", "Diamond III", etc.
  const parts = rankName.split(' ');
  if (parts.length < 2) return null;

  const tierName = parts[0];
  const divisionStr = parts[1];

  // Roman numeral to number
  const divMap: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
  const division = divMap[divisionStr];
  if (!division) return null;

  // Calculate cumulative RP to reach this tier/division
  let cumulativeRP = 0;
  let foundTier = false;
  let floorRP = 0;
  let ceilRP = 0;
  let nextRankName = '';
  let nextRankRP = 0;

  for (let t = 0; t < RANK_TIERS.length; t++) {
    const tier = RANK_TIERS[t];

    if (tier.rpPerDivision === null) {
      // Master/Predator -- no divisions
      if (tier.name === tierName) {
        floorRP = cumulativeRP;
        ceilRP = Infinity;
        nextRankName = tier.name;
        nextRankRP = Infinity;
        foundTier = true;
      }
      continue;
    }

    for (let d = tier.divisions; d >= 1; d--) {
      const divFloor = cumulativeRP;
      cumulativeRP += tier.rpPerDivision;

      if (tier.name === tierName && d === division) {
        floorRP = divFloor;
        ceilRP = cumulativeRP;
        foundTier = true;

        // Next rank
        if (d > 1) {
          const romanMap: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
          nextRankName = `${tier.name} ${romanMap[d - 1]}`;
          nextRankRP = cumulativeRP;
        } else if (t + 1 < RANK_TIERS.length) {
          const nextTier = RANK_TIERS[t + 1];
          if (nextTier.divisions > 1) {
            nextRankName = `${nextTier.name} IV`;
          } else {
            nextRankName = nextTier.name;
          }
          nextRankRP = cumulativeRP;
        }
      }
    }
  }

  if (!foundTier) return null;

  return { floorRP, ceilRP, tierName, division, nextRankName, nextRankRP };
}

export class RankedProgressRule implements CoachingRule {
  id = 'ranked-progress';
  name = 'Ranked Progress Tracker';

  evaluatePostMatch(matchId: number, _sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Check if this was a ranked match
    const matchMode = ctx.queryOne<MatchModeRow>(
      'SELECT mode FROM matches WHERE id = ?',
      matchId,
    );
    if (!matchMode || matchMode.mode !== 'ranked') return results;

    // Get player rank info
    const playerRank = ctx.queryOne<PlayerRankRow>(
      `SELECT rank_name, rank_score FROM player_profile ORDER BY fetched_at DESC LIMIT 1`,
    );
    if (!playerRank || !playerRank.rank_name) return results;

    // Get recent ranked matches RP changes
    const rankedMatches = ctx.query<RankedMatchRow>(
      `SELECT rp_change, placement FROM matches
       WHERE mode = 'ranked' AND rp_change IS NOT NULL
       ORDER BY started_at DESC LIMIT 10`,
    );
    if (rankedMatches.length === 0) return results;

    const rankInfo = getRankInfo(playerRank.rank_name);
    const totalRpChange = rankedMatches.reduce((sum, m) => sum + m.rp_change, 0);
    const avgRpChange = totalRpChange / rankedMatches.length;

    // RP gain/loss trend reporting
    if (totalRpChange > 0) {
      results.push({
        type: InsightType.RANKED_MILESTONE,
        ruleId: this.id,
        message: `You've gained ${totalRpChange} RP in your last ${rankedMatches.length} ranked games (avg +${Math.round(avgRpChange)}/game). Keep up the pace!`,
        severity: InsightSeverity.INFO,
        data: {
          totalRpChange,
          avgRpChange: Math.round(avgRpChange),
          gamesAnalyzed: rankedMatches.length,
          rankName: playerRank.rank_name,
          rankScore: playerRank.rank_score,
        },
      });
    } else if (totalRpChange < 0) {
      results.push({
        type: InsightType.RANKED_MILESTONE,
        ruleId: this.id,
        message: `You've lost ${Math.abs(totalRpChange)} RP over your last ${rankedMatches.length} ranked games. Consider taking a break or reviewing your drop spots.`,
        severity: InsightSeverity.WARNING,
        data: {
          totalRpChange,
          avgRpChange: Math.round(avgRpChange),
          gamesAnalyzed: rankedMatches.length,
          rankName: playerRank.rank_name,
          rankScore: playerRank.rank_score,
        },
      });
    }

    if (!rankInfo) return results;

    // Demotion risk warning
    const rpAboveFloor = playerRank.rank_score - rankInfo.floorRP;
    if (rpAboveFloor <= COACHING_THRESHOLDS.RANKED_DEMOTION_WARNING_RP && avgRpChange < 0) {
      results.push({
        type: InsightType.RANKED_MILESTONE,
        ruleId: this.id,
        message: `Careful -- you're only ${rpAboveFloor} RP from demotion out of ${playerRank.rank_name}. Play it safe or take a break.`,
        severity: InsightSeverity.WARNING,
        data: {
          rpAboveFloor,
          rankName: playerRank.rank_name,
          floorRP: rankInfo.floorRP,
          demotionRisk: true,
        },
      });
    }

    // Games to next rank projection
    if (avgRpChange > 0 && rankInfo.ceilRP !== Infinity) {
      const rpNeeded = rankInfo.ceilRP - playerRank.rank_score;
      if (rpNeeded > 0) {
        const gamesNeeded = Math.ceil(rpNeeded / avgRpChange);
        results.push({
          type: InsightType.RANKED_MILESTONE,
          ruleId: this.id,
          message: `At your current pace (+${Math.round(avgRpChange)} RP/game), you need ${gamesNeeded} more games to reach ${rankInfo.nextRankName}!`,
          severity: InsightSeverity.INFO,
          data: {
            gamesNeeded,
            rpNeeded,
            nextRank: rankInfo.nextRankName,
            avgRpGain: Math.round(avgRpChange),
          },
        });
      }
    }

    // Rank milestone celebration (recently crossed into new tier)
    if (rpAboveFloor <= 100 && rpAboveFloor > 0 && avgRpChange > 0) {
      // Just crossed into this rank
      results.push({
        type: InsightType.RANKED_MILESTONE,
        ruleId: this.id,
        message: `You just hit ${playerRank.rank_name}! Congratulations on the rank up!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: {
          milestone: true,
          rankName: playerRank.rank_name,
          rankScore: playerRank.rank_score,
        },
      });
    }

    return results;
  }
}
