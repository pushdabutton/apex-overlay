// ============================================================
// Tilt Detection Rule
// Detects consecutive ranked losses and win streaks.
//
// Loss streaks:
//   3 consecutive:  Suggestion to take a break
//   5 consecutive:  Warning with total RP lost
//
// Win streaks:
//   3+ consecutive: Achievement with total RP gained
//
// Only applies to ranked matches (mode = 'ranked').
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';

interface RankedMatchRow {
  rp_change: number;
}

export class TiltDetectionRule implements CoachingRule {
  id = 'tilt-detection';
  name = 'Tilt Detection';

  evaluateSession(sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Query last N ranked matches, most recent first
    const matches = ctx.query<RankedMatchRow>(
      `SELECT rp_change FROM matches
       WHERE mode = 'ranked' AND rp_change IS NOT NULL
       ORDER BY started_at DESC LIMIT 20`,
    );

    if (matches.length < 3) {
      return results;
    }

    // Count consecutive losses from most recent backwards
    let consecutiveLosses = 0;
    let lossRpTotal = 0;
    for (const m of matches) {
      if (m.rp_change < 0) {
        consecutiveLosses++;
        lossRpTotal += m.rp_change;
      } else {
        break;
      }
    }

    // Count consecutive wins from most recent backwards
    let consecutiveWins = 0;
    let winRpTotal = 0;
    for (const m of matches) {
      if (m.rp_change > 0) {
        consecutiveWins++;
        winRpTotal += m.rp_change;
      } else {
        break;
      }
    }

    // Loss streak detection
    if (consecutiveLosses >= 5) {
      results.push({
        type: InsightType.TILT_WARNING,
        ruleId: this.id,
        message: `You're on a ${consecutiveLosses}-game losing streak (${lossRpTotal} RP lost). Your performance typically drops when tilted. Take a break and come back fresh.`,
        severity: InsightSeverity.WARNING,
        data: { consecutiveLosses, totalRpChange: lossRpTotal },
      });
    } else if (consecutiveLosses >= 3) {
      results.push({
        type: InsightType.TILT_WARNING,
        ruleId: this.id,
        message: `You've lost RP in ${consecutiveLosses} straight games (${lossRpTotal} RP lost). Consider taking a 5-minute break.`,
        severity: InsightSeverity.SUGGESTION,
        data: { consecutiveLosses, totalRpChange: lossRpTotal },
      });
    }

    // Win streak detection
    if (consecutiveWins >= 3) {
      results.push({
        type: InsightType.WIN_STREAK,
        ruleId: this.id,
        message: `You're on a ${consecutiveWins}-game winning streak! (+${winRpTotal} RP). Keep the momentum going!`,
        severity: InsightSeverity.ACHIEVEMENT,
        data: { consecutiveWins, totalRpChange: winRpTotal },
      });
    }

    return results;
  }
}
