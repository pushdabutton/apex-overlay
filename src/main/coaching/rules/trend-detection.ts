// ============================================================
// Trend Detection Rule (Enhanced)
// Detects improving/declining/plateau trends over 3+ sessions.
// Provides actionable advice and percentage-based deltas.
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

    // Check damage trend
    const damageTrend = detectTrend(avgDamages);
    if (damageTrend === 'improving') {
      const newestAvg = avgDamages[0];
      const oldestAvg = avgDamages[avgDamages.length - 1];
      const delta = Math.round(newestAvg - oldestAvg);
      const pct = oldestAvg > 0 ? Math.round(((newestAvg - oldestAvg) / oldestAvg) * 100) : 0;
      results.push({
        type: InsightType.TREND_IMPROVING,
        ruleId: this.id,
        message: `Your average damage has improved ${pct}% over your last ${sessions.length} sessions (+${delta} avg). Keep pushing -- you're getting better!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { metric: 'damage', trend: 'improving', delta, pct, sessions: sessions.length },
      });
    } else if (damageTrend === 'declining') {
      const newestAvg = avgDamages[0];
      const oldestAvg = avgDamages[avgDamages.length - 1];
      const delta = Math.round(oldestAvg - newestAvg);
      results.push({
        type: InsightType.TREND_DECLINING,
        ruleId: this.id,
        message: `Your average damage has been declining for ${sessions.length} sessions (-${delta} avg). Consider reviewing your positioning, weapon choices, or take a break to reset.`,
        severity: InsightSeverity.WARNING,
        data: { metric: 'damage', trend: 'declining', delta, sessions: sessions.length },
      });
    } else if (damageTrend === 'plateau' && sessions.length >= 5) {
      // Plateau: consistent stats over 5+ sessions
      const mean = avgDamages.reduce((a, b) => a + b, 0) / avgDamages.length;
      results.push({
        type: InsightType.TREND_PLATEAU,
        ruleId: this.id,
        message: `Your damage per game has been consistent around ${Math.round(mean)} for ${sessions.length} sessions. To break through this plateau, try new legends or landing spots.`,
        severity: InsightSeverity.INFO,
        data: { metric: 'damage', trend: 'plateau', mean: Math.round(mean), sessions: sessions.length },
      });
    }

    // Also check kills trend
    const killsTrend = detectTrend(avgKills);
    if (killsTrend === 'improving') {
      const newestAvg = avgKills[0];
      const oldestAvg = avgKills[avgKills.length - 1];
      const pct = oldestAvg > 0 ? Math.round(((newestAvg - oldestAvg) / oldestAvg) * 100) : 0;
      if (pct >= 10) {
        results.push({
          type: InsightType.TREND_IMPROVING,
          ruleId: this.id,
          message: `Your K/D has improved ${pct}% over your last ${sessions.length} sessions. You're becoming a real threat!`,
          severity: InsightSeverity.ACHIEVEMENT,
          data: { metric: 'kills', trend: 'improving', pct, sessions: sessions.length },
        });
      }
    } else if (killsTrend === 'declining') {
      const newestAvg = avgKills[0];
      const oldestAvg = avgKills[avgKills.length - 1];
      const pct = oldestAvg > 0 ? Math.round(((oldestAvg - newestAvg) / oldestAvg) * 100) : 0;
      if (pct >= 10) {
        results.push({
          type: InsightType.TREND_DECLINING,
          ruleId: this.id,
          message: `Your kill rate has dropped ${pct}% over the last ${sessions.length} sessions. Try focusing on aim training or playing with a premade squad.`,
          severity: InsightSeverity.WARNING,
          data: { metric: 'kills', trend: 'declining', pct, sessions: sessions.length },
        });
      }
    }

    return results;
  }
}

/**
 * Detect if a series (most recent first) is trending up, down, flat, or plateau.
 * Requires 3+ consecutive movements in the same direction for improving/declining.
 * Plateau means all values are within TREND_PLATEAU_BAND (8%) of the mean.
 */
function detectTrend(values: number[]): 'improving' | 'declining' | 'plateau' | 'flat' {
  if (values.length < 3) return 'flat';

  // Check for plateau first (if 5+ values and all within 8% of mean)
  if (values.length >= 5) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean > 0) {
      const allWithinBand = values.every(
        (v) => Math.abs(v - mean) / mean <= COACHING_THRESHOLDS.TREND_PLATEAU_BAND,
      );
      if (allWithinBand) return 'plateau';
    }
  }

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
