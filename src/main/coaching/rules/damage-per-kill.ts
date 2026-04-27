// ============================================================
// Damage Per Kill (DPK) Rule -- THE differentiator
// No competitor provides this metric. Computes damage/kills
// ratio and coaches based on pro-level benchmarks.
//
// Benchmarks:
//   < 200:   Pro-level efficiency (achievement)
//   200-350: Solid ratio (info)
//   350-500: Spreading damage, not finishing (suggestion)
//   500+:    Damage farming / poking from range (warning)
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';

interface MatchStatsRow {
  kills: number;
  damage: number;
}

interface AvgDpkRow {
  avg_dpk: number;
}

export class DamagePerKillRule implements CoachingRule {
  id = 'damage-per-kill';
  name = 'Damage Per Kill Analysis';

  evaluatePostMatch(matchId: number, sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Get match stats
    const match = ctx.queryOne<MatchStatsRow>(
      `SELECT kills, damage FROM matches WHERE id = ?`,
      matchId,
    );

    if (!match || match.kills === 0) {
      return results;
    }

    const dpk = Math.round(match.damage / match.kills);

    // Determine severity and message based on DPK benchmarks
    let severity: InsightSeverity;
    let message: string;

    if (dpk < 200) {
      severity = InsightSeverity.ACHIEVEMENT;
      message = `Clean fragging! ${dpk} damage per kill. Pro-level efficiency.`;
    } else if (dpk <= 350) {
      severity = InsightSeverity.INFO;
      message = `Solid damage-to-kill ratio at ${dpk}.`;
    } else if (dpk <= 500) {
      severity = InsightSeverity.SUGGESTION;
      message = `Your damage per kill was ${dpk} (${match.damage} damage, ${match.kills} kills). You may be spreading damage without finishing fights. Focus on committing to knocks.`;
    } else {
      severity = InsightSeverity.WARNING;
      message = `High damage (${match.damage}) but only ${match.kills} kills (${dpk} per kill). This usually means poking from range. Push with your team to convert knocks to kills.`;
    }

    const data: Record<string, unknown> = {
      dpk,
      damage: match.damage,
      kills: match.kills,
    };

    // Session DPK average comparison
    const sessionAvg = ctx.queryOne<AvgDpkRow>(
      `SELECT AVG(CAST(damage AS REAL) / NULLIF(kills, 0)) as avg_dpk
       FROM matches WHERE session_id = ? AND kills > 0`,
      sessionId,
    );

    const historicalAvg = ctx.queryOne<AvgDpkRow>(
      `SELECT AVG(CAST(damage AS REAL) / NULLIF(kills, 0)) as avg_dpk
       FROM matches WHERE kills > 0
       ORDER BY started_at DESC LIMIT 50`,
    );

    if (sessionAvg?.avg_dpk != null) {
      data.sessionAvgDpk = Math.round(sessionAvg.avg_dpk);
    }

    if (historicalAvg?.avg_dpk != null) {
      data.historicalAvgDpk = Math.round(historicalAvg.avg_dpk);
    }

    results.push({
      type: InsightType.DAMAGE_PER_KILL,
      ruleId: this.id,
      message,
      severity,
      data,
    });

    return results;
  }
}
