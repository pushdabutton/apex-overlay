// ============================================================
// Knock-to-Kill Conversion Rule
// Detects unfinished fights by comparing knockdowns to kills.
//
// Benchmarks:
//   ratio <= 1.2: Perfect finishing (achievement)
//   ratio 1.2-1.5: Normal, some stolen by teammates (info)
//   ratio 1.5-2.0: Not finishing knocks (suggestion)
//   ratio > 2.0:   Serious finishing problem (warning)
//
// Special cases:
//   both 0: skip
//   0 knocks, >0 kills: cleanup kill message
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';

interface MatchStatsRow {
  kills: number;
  knockdowns: number;
}

export class KnockConversionRule implements CoachingRule {
  id = 'knock-conversion';
  name = 'Knock-to-Kill Conversion';

  evaluatePostMatch(matchId: number, _sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    const match = ctx.queryOne<MatchStatsRow>(
      `SELECT kills, knockdowns FROM matches WHERE id = ?`,
      matchId,
    );

    if (!match) {
      return results;
    }

    const { kills, knockdowns } = match;

    // Skip if both are 0
    if (knockdowns === 0 && kills === 0) {
      return results;
    }

    // Special case: cleanup kills (0 knocks, >0 kills)
    if (knockdowns === 0 && kills > 0) {
      results.push({
        type: InsightType.KNOCK_CONVERSION,
        ruleId: this.id,
        message: `You're getting cleanup kills. Try to be the one initiating knocks.`,
        severity: InsightSeverity.INFO,
        data: { kills, knockdowns, cleanup: true },
      });
      return results;
    }

    // Normal case: compute ratio
    const ratio = kills > 0 ? knockdowns / kills : Infinity;

    let severity: InsightSeverity;
    let message: string;

    if (ratio <= 1.2) {
      severity = InsightSeverity.ACHIEVEMENT;
      message = `Perfect finishing! ${knockdowns} knocks, ${kills} kills.`;
    } else if (ratio <= 1.5) {
      severity = InsightSeverity.INFO;
      message = `${knockdowns} knocks, ${kills} kills. Some knocks finished by teammates -- normal in squad play.`;
    } else if (ratio <= 2.0) {
      severity = InsightSeverity.SUGGESTION;
      message = `You knocked ${knockdowns} but only killed ${kills}. Focus on thirsting knocks before rotating.`;
    } else {
      severity = InsightSeverity.WARNING;
      message = `You knocked ${knockdowns} enemies but only secured ${kills} kills. Prioritize finishing downed enemies -- each unfinished knock can cost your squad.`;
    }

    results.push({
      type: InsightType.KNOCK_CONVERSION,
      ruleId: this.id,
      message,
      severity,
      data: { kills, knockdowns, ratio: Math.round(ratio * 100) / 100 },
    });

    return results;
  }
}
