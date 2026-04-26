// ============================================================
// Session Comparison Rule
// Compares current session metrics to 7-day rolling averages
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS } from '../../../shared/constants';
import { percentChange } from '../../../shared/utils';

interface DailyAvg {
  avg_kills: number;
  avg_damage: number;
  avg_headshots: number;
  avg_placement: number | null;
}

interface SessionMetrics {
  matches_played: number;
  total_kills: number;
  total_deaths: number;
  total_damage: number;
  total_headshots: number;
  avg_placement: number | null;
}

export class SessionComparisonRule implements CoachingRule {
  id = 'session-comparison';
  name = 'Session vs 7-Day Average';

  evaluatePostMatch(matchId: number, sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Get current session metrics
    const session = ctx.queryOne<SessionMetrics>(
      'SELECT * FROM sessions WHERE id = ?',
      sessionId,
    );
    if (!session || session.matches_played < 2) return results;

    // Get 7-day rolling averages from daily aggregates
    const weekAvg = ctx.queryOne<DailyAvg>(`
      SELECT
        AVG(total_kills * 1.0 / NULLIF(games_played, 0)) as avg_kills,
        AVG(total_damage * 1.0 / NULLIF(games_played, 0)) as avg_damage,
        AVG(total_headshots * 1.0 / NULLIF(games_played, 0)) as avg_headshots,
        AVG(avg_placement) as avg_placement
      FROM daily_aggregates
      WHERE date >= date('now', '-7 days')
        AND games_played > 0
    `);

    if (!weekAvg || !weekAvg.avg_kills) return results;

    // Compare session averages to weekly averages
    const sessionAvgKills = session.total_kills / session.matches_played;
    const sessionAvgDamage = session.total_damage / session.matches_played;

    // Kills comparison
    const killsDelta = percentChange(sessionAvgKills, weekAvg.avg_kills);
    if (killsDelta > COACHING_THRESHOLDS.SIGNIFICANT_POSITIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE,
        ruleId: this.id,
        message: `Your kills are ${Math.round(killsDelta)}% above your weekly average. You're on fire!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'kills', delta: killsDelta, current: sessionAvgKills, average: weekAvg.avg_kills },
      });
    } else if (killsDelta < COACHING_THRESHOLDS.SIGNIFICANT_NEGATIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE,
        ruleId: this.id,
        message: `Your kills dropped ${Math.round(Math.abs(killsDelta))}% vs your weekly average. Consider adjusting your aggression or positioning.`,
        severity: InsightSeverity.WARNING,
        data: { metric: 'kills', delta: killsDelta, current: sessionAvgKills, average: weekAvg.avg_kills },
      });
    }

    // Damage comparison
    const damageDelta = percentChange(sessionAvgDamage, weekAvg.avg_damage);
    if (damageDelta > COACHING_THRESHOLDS.SIGNIFICANT_POSITIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE,
        ruleId: this.id,
        message: `Your damage is ${Math.round(damageDelta)}% above your weekly average. Great aim today!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'damage', delta: damageDelta, current: sessionAvgDamage, average: weekAvg.avg_damage },
      });
    } else if (damageDelta < COACHING_THRESHOLDS.SIGNIFICANT_NEGATIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE,
        ruleId: this.id,
        message: `Your damage dropped ${Math.round(Math.abs(damageDelta))}% vs your weekly average. Try warming up in the firing range.`,
        severity: InsightSeverity.SUGGESTION,
        data: { metric: 'damage', delta: damageDelta, current: sessionAvgDamage, average: weekAvg.avg_damage },
      });
    }

    return results;
  }
}
