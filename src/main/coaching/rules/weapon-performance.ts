// ============================================================
// Weapon Performance Rule
// Analyzes kill-feed weapon data to identify top weapons,
// underperforming weapons, and meta weapon alignment.
//
// Runs TWO queries at post-match:
//   1. Current session weapon kills (session_id = ?)
//   2. Historical weapon kills (last 20 matches)
//
// Combines both to produce layered coaching insights that
// focus on the CURRENT SESSION with HISTORICAL context.
// Max 2 insights per post-match to avoid spamming.
// ============================================================

import type { CoachingRule, RuleContext, RuleResult } from '../types';
import { InsightType, InsightSeverity } from '../../../shared/types';
import { COACHING_THRESHOLDS } from '../../../shared/constants';

interface WeaponKillRow {
  weapon: string;
  kill_count: number;
}

// Weapons that are consistently strong in the meta
const META_WEAPONS = new Set([
  'R-301',
  'Flatline',
  'Peacekeeper',
  'Wingman',
  'Volt',
  'R-99',
  'Mastiff',
  'Nemesis',
  'Hemlok',
]);

const MAX_INSIGHTS = 2;

export class WeaponPerformanceRule implements CoachingRule {
  id = 'weapon-performance';
  name = 'Weapon Performance Analysis';

  evaluatePostMatch(_matchId: number, _sessionId: number, ctx: RuleContext): RuleResult[] {
    // --- Query 1: Current session weapon kills ---
    const sessionKills = ctx.query<WeaponKillRow>(
      `SELECT wk.weapon, SUM(wk.kills) as kill_count
       FROM weapon_kills wk
       WHERE wk.weapon IS NOT NULL AND wk.weapon != ''
         AND wk.session_id = ?
       GROUP BY wk.weapon
       ORDER BY kill_count DESC`,
      _sessionId,
    );

    // --- Query 2: Historical weapon kills (last 20 matches, all sessions) ---
    const historicalKills = ctx.query<WeaponKillRow>(
      `SELECT wk.weapon, SUM(wk.kills) as kill_count
       FROM weapon_kills wk
       WHERE wk.weapon IS NOT NULL AND wk.weapon != ''
         AND wk.match_id IN (
           SELECT id FROM matches ORDER BY id DESC LIMIT 20
         )
       GROUP BY wk.weapon
       ORDER BY kill_count DESC`,
    );

    // --- Calculate totals ---
    const sessionTotal = sessionKills.reduce((sum, w) => sum + w.kill_count, 0);
    const histTotal = historicalKills.reduce((sum, w) => sum + w.kill_count, 0);

    // Need minimum kills from EITHER source for meaningful analysis
    if (sessionTotal < COACHING_THRESHOLDS.WEAPON_MIN_KILLS && histTotal < COACHING_THRESHOLDS.WEAPON_MIN_KILLS) {
      return [];
    }

    // --- Derive key facts ---
    const sessionTopWeapon = sessionKills.length > 0 ? sessionKills[0] : null;
    const histTopWeapon = historicalKills.length > 0 ? historicalKills[0] : null;
    const sessionWeaponNames = new Set(sessionKills.map((w) => w.weapon));

    const sameTopWeapon =
      sessionTopWeapon != null &&
      histTopWeapon != null &&
      sessionTopWeapon.weapon === histTopWeapon.weapon;

    // --- Build candidate insights (prioritized) ---
    const candidates: RuleResult[] = [];

    // (C) Session + historical alignment -- highest priority when applicable
    if (sameTopWeapon && sessionTotal >= COACHING_THRESHOLDS.WEAPON_MIN_KILLS) {
      const isMeta = META_WEAPONS.has(sessionTopWeapon!.weapon);
      const metaNote = isMeta ? " It's strong in the current meta too." : '';
      candidates.push({
        type: InsightType.WEAPON_PERFORMANCE,
        ruleId: this.id,
        message: `The ${sessionTopWeapon!.weapon} is your go-to weapon and it's working this session -- ${sessionTopWeapon!.kill_count} kills. Stay with it.${metaNote}`,
        severity: InsightSeverity.INFO,
        data: {
          aligned: true,
          sessionTop: true,
          weapon: sessionTopWeapon!.weapon,
          killCount: sessionTopWeapon!.kill_count,
          sessionTotal,
        },
      });
    } else {
      // (A) Current session top weapon
      if (sessionTopWeapon != null && sessionTotal >= COACHING_THRESHOLDS.WEAPON_MIN_KILLS) {
        const topPct = Math.round((sessionTopWeapon.kill_count / sessionTotal) * 100);
        const isMeta = META_WEAPONS.has(sessionTopWeapon.weapon);
        const metaNote = isMeta ? " It's strong in the current meta -- lean into it!" : '';
        candidates.push({
          type: InsightType.WEAPON_PERFORMANCE,
          ruleId: this.id,
          message: `${sessionTopWeapon.weapon} accounts for ${topPct}% of your kills this session (${sessionTopWeapon.kill_count} of ${sessionTotal}).${metaNote}`,
          severity: InsightSeverity.INFO,
          data: {
            sessionTop: true,
            weapon: sessionTopWeapon.weapon,
            killCount: sessionTopWeapon.kill_count,
            totalKills: sessionTotal,
            pct: topPct,
          },
        });
      }

      // (B) Historical best weapon context (only if different from session top)
      if (
        histTopWeapon != null &&
        histTotal >= COACHING_THRESHOLDS.WEAPON_MIN_KILLS &&
        (sessionTopWeapon == null || histTopWeapon.weapon !== sessionTopWeapon.weapon)
      ) {
        const histPct = Math.round((histTopWeapon.kill_count / histTotal) * 100);
        const isMeta = META_WEAPONS.has(histTopWeapon.weapon);
        const metaNote = isMeta ? " It's strong in the meta right now." : '';
        candidates.push({
          type: InsightType.WEAPON_PERFORMANCE,
          ruleId: this.id,
          message: `The ${histTopWeapon.weapon} is your best weapon across recent games (${histPct}% of kills). Keep an eye out for it.${metaNote}`,
          severity: InsightSeverity.INFO,
          data: {
            historicalBest: true,
            weapon: histTopWeapon.weapon,
            killCount: histTopWeapon.kill_count,
            totalKills: histTotal,
            pct: histPct,
          },
        });
      }
    }

    // (E) Underperforming weapon (historical, only if also used this session)
    if (historicalKills.length >= 3 && candidates.length < MAX_INSIGHTS) {
      const histAvgPct = 100 / historicalKills.length;
      for (const weapon of historicalKills) {
        const weaponPct = (weapon.kill_count / histTotal) * 100;
        // Underperforming: below 40% of average share, at least 3 kills, AND used this session
        if (
          weaponPct < histAvgPct * 0.4 &&
          weapon.kill_count >= 3 &&
          sessionWeaponNames.has(weapon.weapon)
        ) {
          candidates.push({
            type: InsightType.WEAPON_PERFORMANCE,
            ruleId: this.id,
            message: `You pick up the ${weapon.weapon} but only get ${Math.round(weaponPct)}% of your kills with it (${weapon.kill_count} kills across recent games). Consider swapping to weapons you perform better with.`,
            severity: InsightSeverity.SUGGESTION,
            data: {
              underperforming: true,
              weapon: weapon.weapon,
              killCount: weapon.kill_count,
              pct: Math.round(weaponPct),
            },
          });
          break; // Only one underperforming callout
        }
      }
    }

    // --- Enforce max 2 insights ---
    return candidates.slice(0, MAX_INSIGHTS);
  }
}
