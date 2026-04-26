// ============================================================
// Trend Detection Rule
// Detects 3+ session improving/declining trends
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS } from '../../../shared/constants';

export class TrendDetectionRule implements CoachingRule {
  id = 'trend-detection';
  name = 'Multi-Session Trend Detection';

  evaluateSession(sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Get last 5 sessions
    const sessions = ctx.query<{
      id: number;
      total_kills: number;
      total_damage: number;
      total_headshots: number;
      matches_played: number;
    }>(
      'SELECT id, total_kills, total_damage, total_headshots, matches_played FROM sessions WHERE matches_played > 0 ORDER BY started_at DESC LIMIT 5',
    );

    if (sessions.length < COACHING_THRESHOLDS.TREND_SESSIONS_REQUIRED) {
      return results;
    }

    // Calculate per-session averages
    const avgDamages = sessions.map((s) => s.total_damage / Math.max(s.matches_played, 1));
    const avgKills = sessions.map((s) => s.total_kills / Math.max(s.matches_played, 1));

    // Check damage trend (most recent first, so ascending = declining, descending = improving)
    const damageTrend = detectTrend(avgDamages);
    if (damageTrend === 'improving') {
      const delta = Math.round(avgDamages[0] - avgDamages[avgDamages.length - 1]);
      results.push({
        type: InsightType.TREND_IMPROVING,
        ruleId: this.id,
        message: `Your average damage has steadily improved over the last ${sessions.length} sessions (+${delta} avg). Keep it up!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'damage', trend: 'improving', delta },
      });
    } else if (damageTrend === 'declining') {
      results.push({
        type: InsightType.TREND_DECLINING,
        ruleId: this.id,
        message: `Your average damage has been declining for ${sessions.length} sessions. Consider reviewing your positioning or weapon choices.`,
        severity: InsightSeverity.WARNING,
        data: { metric: 'damage', trend: 'declining' },
      });
    }

    return results;
  }
}

/**
 * Detect if a series (most recent first) is trending up, down, or flat.
 * Requires 3+ consecutive movements in the same direction.
 */
function detectTrend(values: number[]): 'improving' | 'declining' | 'flat' {
  if (values.length < 3) return 'flat';

  let improvingCount = 0;
  let decliningCount = 0;

  // values[0] is most recent, values[n] is oldest
  // "improving" means each older session had lower value than the next
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] > values[i + 1]) improvingCount++;
    else if (values[i] < values[i + 1]) decliningCount++;
  }

  if (improvingCount >= 3) return 'improving';
  if (decliningCount >= 3) return 'declining';
  return 'flat';
}
