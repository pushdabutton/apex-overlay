// ============================================================
// Legend Recommendation Rule (Enhanced)
// Suggests better-performing legends, celebrates mains,
// discovers underplayed gems, and nudges single-legend players.
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS } from '../../../shared/constants';

interface LegendRow {
  legend: string;
  games_played: number;
  avg_kills: number;
  avg_damage: number;
  win_rate: number;
}

export class LegendRecommendationRule implements CoachingRule {
  id = 'legend-recommendation';
  name = 'Legend Performance Comparison';

  evaluatePostMatch(matchId: number, _sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Get current match legend
    const match = ctx.queryOne<{ legend: string }>(
      'SELECT legend FROM matches WHERE id = ?',
      matchId,
    );
    if (!match) return results;

    // Get all legends with sufficient game count
    const legends = ctx.query<LegendRow>(
      `SELECT legend, games_played, avg_kills, avg_damage, win_rate
       FROM legend_stats
       WHERE games_played >= ?
       ORDER BY (avg_kills * 0.3 + avg_damage * 0.003 + win_rate * 40) DESC`,
      COACHING_THRESHOLDS.MIN_GAMES_FOR_LEGEND_COMPARE,
    );

    // Also get underplayed legends (fewer than threshold games but at least 3)
    const underplayed = ctx.query<LegendRow>(
      `SELECT legend, games_played, avg_kills, avg_damage, win_rate
       FROM legend_stats
       WHERE games_played < ? AND games_played >= 3
       ORDER BY win_rate DESC`,
      COACHING_THRESHOLDS.UNDERPLAYED_LEGEND_MAX_GAMES,
    );

    // Handle single-legend players: only 1 legend with enough data
    if (legends.length <= 1) {
      if (legends.length === 1) {
        results.push({
          type: InsightType.LEGEND_RECOMMENDATION,
          ruleId: this.id,
          message: `You've played ${legends[0].games_played} games exclusively on ${legends[0].legend}. Try branching out -- you might discover a legend that fits even better!`,
          severity: InsightSeverity.SUGGESTION,
          data: { currentLegend: match.legend, singleLegend: true, gamesPlayed: legends[0].games_played },
        });
      }

      // Check for underplayed gems even for single-legend players
      this.checkUnderplayedGems(results, underplayed, match.legend);
      return results;
    }

    if (legends.length < COACHING_THRESHOLDS.MIN_LEGENDS_FOR_COMPARISON) {
      // Not enough legends for full comparison -- still check underplayed
      this.checkUnderplayedGems(results, underplayed, match.legend);
      return results;
    }

    // Find current legend's stats
    const currentStats = legends.find((l) => l.legend === match.legend);
    const bestStats = legends[0];

    if (!currentStats || !bestStats) {
      this.checkUnderplayedGems(results, underplayed, match.legend);
      return results;
    }

    if (currentStats.legend === bestStats.legend) {
      // Player is already on their best legend
      const secondBest = legends[1];
      const advantage = secondBest
        ? Math.round(((currentStats.avg_kills - secondBest.avg_kills) / Math.max(secondBest.avg_kills, 1)) * 100)
        : 0;
      results.push({
        type: InsightType.LEGEND_RECOMMENDATION,
        ruleId: this.id,
        message: `You're on your main -- you average ${advantage > 0 ? `${advantage}% more kills` : 'the most kills'} on ${bestStats.legend}. Great choice!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { currentLegend: match.legend, bestLegend: bestStats.legend, advantage },
      });

      this.checkUnderplayedGems(results, underplayed, match.legend);
      return results;
    }

    // Calculate performance gap
    const currentScore = currentStats.avg_kills * 0.3 + currentStats.avg_damage * 0.003 + currentStats.win_rate * 40;
    const bestScore = bestStats.avg_kills * 0.3 + bestStats.avg_damage * 0.003 + bestStats.win_rate * 40;

    const gap = bestScore > 0 ? (bestScore - currentScore) / bestScore : 0;

    if (gap > COACHING_THRESHOLDS.LEGEND_PERFORMANCE_GAP) {
      const damageGap = Math.round(bestStats.avg_damage - currentStats.avg_damage);
      results.push({
        type: InsightType.LEGEND_RECOMMENDATION,
        ruleId: this.id,
        message: `You average ${damageGap} more damage on ${bestStats.legend} than ${match.legend}. Consider switching?`,
        severity: InsightSeverity.SUGGESTION,
        data: {
          currentLegend: match.legend,
          bestLegend: bestStats.legend,
          damageGap,
          gap: Math.round(gap * 100),
        },
      });
    }

    this.checkUnderplayedGems(results, underplayed, match.legend);
    return results;
  }

  /**
   * Check for underplayed legends with surprisingly good stats.
   */
  private checkUnderplayedGems(
    results: RuleResult[],
    underplayed: LegendRow[],
    currentLegend: string,
  ): void {
    for (const legend of underplayed) {
      if (legend.legend === currentLegend) continue;
      if (legend.win_rate >= COACHING_THRESHOLDS.UNDERPLAYED_LEGEND_MIN_WIN_RATE) {
        results.push({
          type: InsightType.LEGEND_RECOMMENDATION,
          ruleId: this.id,
          message: `You've only played ${legend.games_played} games on ${legend.legend} but your win rate is ${Math.round(legend.win_rate * 100)}%. Worth exploring more!`,
          severity: InsightSeverity.SUGGESTION,
          data: {
            legend: legend.legend,
            gamesPlayed: legend.games_played,
            winRate: legend.win_rate,
            underplayed: true,
          },
        });
        break; // Only suggest one underplayed legend per evaluation
      }
    }
  }
}
