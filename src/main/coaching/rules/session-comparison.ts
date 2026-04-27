// ============================================================
// Session Comparison Rule (Enhanced)
// Compares current session metrics to 7-day rolling averages.
// Detects hot/cold streaks, provides specific stat callouts
// with absolute difference, scales severity by magnitude.
//
// Uses SESSION_VS_AVERAGE_KILLS and SESSION_VS_AVERAGE_DAMAGE
// as separate insight types to avoid dedup suppression when
// both stats are noteworthy in the same session.
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

    // Kills comparison with hot/cold streak detection
    const killsDelta = percentChange(sessionAvgKills, weekAvg.avg_kills);
    const killsAbsDiff = Math.round(sessionAvgKills - weekAvg.avg_kills);

    if (killsDelta >= COACHING_THRESHOLDS.HOT_STREAK_DELTA * 100) {
      // Hot streak: 30%+ above average
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_KILLS,
        ruleId: this.id,
        message: `Hot streak! Your kills are ${Math.round(killsDelta)}% above your weekly average (${sessionAvgKills.toFixed(1)} vs ${weekAvg.avg_kills.toFixed(1)} avg). You're on fire!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'kills', delta: killsDelta, current: sessionAvgKills, average: weekAvg.avg_kills, hotStreak: true, absDiff: killsAbsDiff },
      });
    } else if (killsDelta > COACHING_THRESHOLDS.SIGNIFICANT_POSITIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_KILLS,
        ruleId: this.id,
        message: `Your kills are ${Math.round(killsDelta)}% above your weekly average. Nice session!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'kills', delta: killsDelta, current: sessionAvgKills, average: weekAvg.avg_kills },
      });
    } else if (killsDelta <= COACHING_THRESHOLDS.COLD_STREAK_DELTA * 100) {
      // Cold streak: 30%+ below average
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_KILLS,
        ruleId: this.id,
        message: `Rough session -- your kills are ${Math.round(Math.abs(killsDelta))}% below your weekly average. Consider taking a break or changing your drop strategy.`,
        severity: InsightSeverity.WARNING,
        data: { metric: 'kills', delta: killsDelta, current: sessionAvgKills, average: weekAvg.avg_kills, coldStreak: true, absDiff: killsAbsDiff },
      });
    } else if (killsDelta < COACHING_THRESHOLDS.SIGNIFICANT_NEGATIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_KILLS,
        ruleId: this.id,
        message: `Your kills dropped ${Math.round(Math.abs(killsDelta))}% vs your weekly average. Consider adjusting your aggression or positioning.`,
        severity: InsightSeverity.WARNING,
        data: { metric: 'kills', delta: killsDelta, current: sessionAvgKills, average: weekAvg.avg_kills },
      });
    }

    // Damage comparison with absolute difference callout
    const damageDelta = percentChange(sessionAvgDamage, weekAvg.avg_damage);
    const damageAbsDiff = Math.round(sessionAvgDamage - weekAvg.avg_damage);

    if (damageDelta >= COACHING_THRESHOLDS.HOT_STREAK_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_DAMAGE,
        ruleId: this.id,
        message: `Your damage is ${damageAbsDiff} above your weekly average tonight (${Math.round(sessionAvgDamage)} vs ${Math.round(weekAvg.avg_damage)}). Incredible output!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'damage', delta: damageDelta, current: sessionAvgDamage, average: weekAvg.avg_damage, hotStreak: true, absDiff: damageAbsDiff },
      });
    } else if (damageDelta > COACHING_THRESHOLDS.SIGNIFICANT_POSITIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_DAMAGE,
        ruleId: this.id,
        message: `Your damage is ${damageAbsDiff} above your weekly average. Great aim today!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'damage', delta: damageDelta, current: sessionAvgDamage, average: weekAvg.avg_damage, absDiff: damageAbsDiff },
      });
    } else if (damageDelta <= COACHING_THRESHOLDS.COLD_STREAK_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_DAMAGE,
        ruleId: this.id,
        message: `Your damage is ${Math.abs(damageAbsDiff)} below your weekly average. Try warming up in the firing range before your next match.`,
        severity: InsightSeverity.WARNING,
        data: { metric: 'damage', delta: damageDelta, current: sessionAvgDamage, average: weekAvg.avg_damage, coldStreak: true, absDiff: damageAbsDiff },
      });
    } else if (damageDelta < COACHING_THRESHOLDS.SIGNIFICANT_NEGATIVE_DELTA * 100) {
      results.push({
        type: InsightType.SESSION_VS_AVERAGE_DAMAGE,
        ruleId: this.id,
        message: `Your damage dropped ${Math.round(Math.abs(damageDelta))}% vs your weekly average. Try warming up in the firing range.`,
        severity: InsightSeverity.SUGGESTION,
        data: { metric: 'damage', delta: damageDelta, current: sessionAvgDamage, average: weekAvg.avg_damage, absDiff: damageAbsDiff },
      });
    }

    return results;
  }
}
