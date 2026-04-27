// ============================================================
// Warm-Up Detection Rule
// Detects if the player consistently performs poorly in their
// first few games of a session vs later games.
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS } from '../../../shared/constants';

interface SessionRow {
  id: number;
  matches_played: number;
}

interface MatchRow {
  session_id: number;
  damage: number;
  kills: number;
  row_num: number;
}

export class WarmUpDetectionRule implements CoachingRule {
  id = 'warmup-detection';
  name = 'Warm-Up Pattern Detection';

  evaluateSession(sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Get recent sessions with enough matches
    const sessions = ctx.query<SessionRow>(
      `SELECT id, matches_played FROM sessions
       WHERE matches_played >= ?
       ORDER BY started_at DESC
       LIMIT 10`,
      COACHING_THRESHOLDS.WARMUP_MIN_MATCHES_PER_SESSION,
    );

    // Need minimum sessions for pattern detection
    if (sessions.length < COACHING_THRESHOLDS.WARMUP_MIN_SESSIONS) {
      return results;
    }

    let totalWarmupDamage = 0;
    let totalWarmupGames = 0;
    let totalLaterDamage = 0;
    let totalLaterGames = 0;

    const warmupGamesToCheck = COACHING_THRESHOLDS.WARMUP_GAMES_TO_CHECK;

    for (const session of sessions) {
      // Get matches for this session ordered by time
      const matches = ctx.query<MatchRow>(
        `SELECT session_id, damage, kills, ROW_NUMBER() OVER (ORDER BY started_at) as row_num
         FROM matches
         WHERE session_id = ?
         ORDER BY started_at`,
        session.id,
      );

      if (matches.length < COACHING_THRESHOLDS.WARMUP_MIN_MATCHES_PER_SESSION) continue;

      for (const m of matches) {
        if (m.row_num <= warmupGamesToCheck) {
          totalWarmupDamage += m.damage;
          totalWarmupGames++;
        } else {
          totalLaterDamage += m.damage;
          totalLaterGames++;
        }
      }
    }

    if (totalWarmupGames === 0 || totalLaterGames === 0) return results;

    const avgWarmupDamage = totalWarmupDamage / totalWarmupGames;
    const avgLaterDamage = totalLaterDamage / totalLaterGames;

    if (avgLaterDamage === 0) return results;

    const deficit = (avgLaterDamage - avgWarmupDamage) / avgLaterDamage;

    if (deficit >= COACHING_THRESHOLDS.WARMUP_DEFICIT_THRESHOLD) {
      // Clear warm-up pattern detected
      const deficitPct = Math.round(deficit * 100);
      results.push({
        type: InsightType.WARM_UP_PATTERN,
        ruleId: this.id,
        message: `Your first ${warmupGamesToCheck} games average ${deficitPct}% less damage than later games (${Math.round(avgWarmupDamage)} vs ${Math.round(avgLaterDamage)}). Consider aim training or a warm-up routine before jumping into matches.`,
        severity: InsightSeverity.SUGGESTION,
        data: {
          avgWarmupDamage: Math.round(avgWarmupDamage),
          avgLaterDamage: Math.round(avgLaterDamage),
          deficitPct,
          sessionsAnalyzed: sessions.length,
          warmupGames: warmupGamesToCheck,
        },
      });
    } else if (deficit < 0.10) {
      // No warm-up pattern -- player starts strong
      results.push({
        type: InsightType.WARM_UP_PATTERN,
        ruleId: this.id,
        message: `You start strong -- your first games are consistent with your overall average. No warm-up needed!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: {
          avgWarmupDamage: Math.round(avgWarmupDamage),
          avgLaterDamage: Math.round(avgLaterDamage),
          deficitPct: Math.round(deficit * 100),
          sessionsAnalyzed: sessions.length,
          noWarmupNeeded: true,
        },
      });
    }

    return results;
  }
}
