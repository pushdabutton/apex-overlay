// ============================================================
// Death Timing Rule
// Analyzes when deaths occur (early, mid, late game)
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS } from '../../../shared/constants';

interface DeathTimingRow {
  survival_time: number;
}

export class DeathTimingRule implements CoachingRule {
  id = 'death-timing';
  name = 'Death Timing Analysis';

  evaluateSession(sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Get death timing data from recent matches where player died
    const deaths = ctx.query<DeathTimingRow>(
      `SELECT survival_time FROM matches
       WHERE deaths > 0 AND survival_time > 0
       ORDER BY started_at DESC LIMIT 20`,
    );

    if (deaths.length < COACHING_THRESHOLDS.MIN_DEATHS_FOR_TIMING) {
      return results;
    }

    // Bucket deaths: early (0-180s), mid (180-600s), late (600s+)
    let early = 0;
    let mid = 0;
    let late = 0;

    for (const d of deaths) {
      if (d.survival_time <= 180) early++;
      else if (d.survival_time <= 600) mid++;
      else late++;
    }

    const total = deaths.length;
    const earlyPct = (early / total) * 100;
    const latePct = (late / total) * 100;

    if (earlyPct > 50) {
      results.push({
        type: InsightType.DEATH_TIMING,
        ruleId: this.id,
        message: `${Math.round(earlyPct)}% of your recent deaths happen in the first 3 minutes. Consider landing at less contested spots or looting longer before engaging.`,
        severity: InsightSeverity.SUGGESTION,
        data: { earlyPct, midPct: (mid / total) * 100, latePct, sampleSize: total },
      });
    } else if (latePct > 60) {
      results.push({
        type: InsightType.DEATH_TIMING,
        ruleId: this.id,
        message: `Most of your deaths (${Math.round(latePct)}%) come in endgame. You survive well early. Focus on ring positioning and circle awareness in late game.`,
        severity: InsightSeverity.INFO,
        data: { earlyPct, midPct: (mid / total) * 100, latePct, sampleSize: total },
      });
    }

    return results;
  }
}
