// ============================================================
// Weapon Performance Rule
// Analyzes kill-feed weapon data to identify top weapons,
// underperforming weapons, and meta weapon alignment.
// Queries the weapon_kills table populated from PLAYER_KILL
// events at match end.
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

export class WeaponPerformanceRule implements CoachingRule {
  id = 'weapon-performance';
  name = 'Weapon Performance Analysis';

  evaluatePostMatch(_matchId: number, _sessionId: number, ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    // Query weapon kills aggregated across recent matches from the weapon_kills table
    const kills = ctx.query<WeaponKillRow>(
      `SELECT weapon, SUM(kills) as kill_count
       FROM weapon_kills
       WHERE weapon IS NOT NULL AND weapon != ''
       GROUP BY weapon
       ORDER BY kill_count DESC`,
    );

    // Calculate total kills
    const totalKills = kills.reduce((sum, w) => sum + w.kill_count, 0);

    // Need minimum kills for meaningful analysis
    if (totalKills < COACHING_THRESHOLDS.WEAPON_MIN_KILLS) {
      return results;
    }

    // Top weapon analysis
    if (kills.length > 0) {
      const topWeapon = kills[0];
      const topPct = Math.round((topWeapon.kill_count / totalKills) * 100);

      if (topPct >= 20) {
        const isMetaWeapon = META_WEAPONS.has(topWeapon.weapon);

        results.push({
          type: InsightType.WEAPON_PERFORMANCE,
          ruleId: this.id,
          message: `${topWeapon.weapon} accounts for ${topPct}% of your kills (${topWeapon.kill_count} of ${totalKills}). ${isMetaWeapon ? "It's strong in the current meta -- lean into it!" : 'You know this weapon well.'}`,
          severity: InsightSeverity.INFO,
          data: {
            topWeapon: true,
            weapon: topWeapon.weapon,
            killCount: topWeapon.kill_count,
            totalKills,
            pct: topPct,
          },
        });

        // Meta alignment callout for top weapon
        if (isMetaWeapon) {
          results.push({
            type: InsightType.WEAPON_PERFORMANCE,
            ruleId: this.id,
            message: `The ${topWeapon.weapon} is strong this season and it's your best weapon -- you're well-aligned with the meta!`,
            severity: InsightSeverity.ACHIEVEMENT,
            data: { metaAligned: true, weapon: topWeapon.weapon, pct: topPct },
          });
        }
      }
    }

    // Underperforming weapon analysis
    // A weapon that has kills but disproportionately low percentage
    if (kills.length >= 3) {
      const avgPct = 100 / kills.length;
      for (const weapon of kills) {
        const weaponPct = (weapon.kill_count / totalKills) * 100;
        // Underperforming: has enough kills to show up but gets less than 40% of average share
        if (weaponPct < avgPct * 0.4 && weapon.kill_count >= 3) {
          results.push({
            type: InsightType.WEAPON_PERFORMANCE,
            ruleId: this.id,
            message: `You pick up the ${weapon.weapon} but only get ${Math.round(weaponPct)}% of your kills with it (${weapon.kill_count} kills). Consider swapping to weapons you perform better with.`,
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

    return results;
  }
}
