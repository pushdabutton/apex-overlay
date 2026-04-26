// ============================================================
// Legend Recommendation Rule
// Suggests better-performing legends based on player's history
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

    if (legends.length < COACHING_THRESHOLDS.MIN_LEGENDS_FOR_COMPARISON) {
      return results;
    }

    // Find current legend's stats
    const currentStats = legends.find((l) => l.legend === match.legend);
    const bestStats = legends[0];

    if (!currentStats || !bestStats) return results;
    if (currentStats.legend === bestStats.legend) {
      // Player is already on their best legend
      results.push({
        type: InsightType.LEGEND_RECOMMENDATION,
        ruleId: this.id,
        message: `You're on your best-performing legend (${bestStats.legend}). Great choice!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { currentLegend: match.legend, bestLegend: bestStats.legend },
      });
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

    return results;
  }
}
