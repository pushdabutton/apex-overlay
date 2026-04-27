// ============================================================
// Weapon Performance Rule -- Unit Tests
// Analyzes kill-feed weapon data to identify top weapons,
// underperforming weapons, and meta alignment.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { WeaponPerformanceRule } from '../../src/main/coaching/rules/weapon-performance';
import type { RuleContext } from '../../src/main/coaching/types';
import { InsightType, InsightSeverity } from '../../src/shared/types';

interface WeaponKillRow {
  weapon: string;
  kill_count: number;
}

function createWeaponContext(
  weaponKills: WeaponKillRow[],
  totalKills?: number,
): RuleContext {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('weapon')) {
        return weaponKills;
      }
      return [];
    }),
    queryOne: vi.fn((sql: string) => {
      if (sql.includes('SUM') || sql.includes('COUNT')) {
        return { total: totalKills ?? weaponKills.reduce((sum, w) => sum + w.kill_count, 0) };
      }
      return undefined;
    }),
  };
}

describe('WeaponPerformanceRule', () => {
  const rule = new WeaponPerformanceRule();

  it('should identify top weapon by kills percentage', () => {
    const weaponKills: WeaponKillRow[] = [
      { weapon: 'R-301', kill_count: 35 },
      { weapon: 'Peacekeeper', kill_count: 25 },
      { weapon: 'Wingman', kill_count: 20 },
      { weapon: 'Mozambique', kill_count: 10 },
      { weapon: 'Sentinel', kill_count: 10 },
    ];
    const ctx = createWeaponContext(weaponKills);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const topWeapon = results.find(
      (r) => r.type === InsightType.WEAPON_PERFORMANCE && r.data && (r.data as Record<string, unknown>).topWeapon,
    );
    expect(topWeapon).toBeDefined();
    expect(topWeapon!.message).toMatch(/R-301/);
    expect(topWeapon!.message).toMatch(/35%/);
  });

  it('should identify underperforming weapon (picked up often, low kills)', () => {
    // Wingman has many "pickup" events but very few kills relative to total
    const weaponKills: WeaponKillRow[] = [
      { weapon: 'R-301', kill_count: 40 },
      { weapon: 'Flatline', kill_count: 30 },
      { weapon: 'Wingman', kill_count: 5 },
      { weapon: 'Peacekeeper', kill_count: 15 },
      { weapon: 'Sentinel', kill_count: 10 },
    ];
    const ctx = createWeaponContext(weaponKills);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    const underperforming = results.find(
      (r) =>
        r.type === InsightType.WEAPON_PERFORMANCE &&
        r.data &&
        (r.data as Record<string, unknown>).underperforming === true,
    );
    expect(underperforming).toBeDefined();
    expect(underperforming!.message).toMatch(/Wingman/);
    expect(underperforming!.severity).toBe(InsightSeverity.SUGGESTION);
  });

  it('should suggest meta alignment when top weapon matches meta', () => {
    const weaponKills: WeaponKillRow[] = [
      { weapon: 'R-301', kill_count: 40 },
      { weapon: 'Flatline', kill_count: 20 },
      { weapon: 'Peacekeeper', kill_count: 15 },
      { weapon: 'Prowler', kill_count: 10 },
      { weapon: 'Wingman', kill_count: 15 },
    ];
    const ctx = createWeaponContext(weaponKills);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    // R-301 is a meta weapon, should get a positive callout
    const metaInsight = results.find(
      (r) =>
        r.type === InsightType.WEAPON_PERFORMANCE &&
        r.data &&
        (r.data as Record<string, unknown>).metaAligned === true,
    );
    expect(metaInsight).toBeDefined();
    expect(metaInsight!.severity).toBe(InsightSeverity.ACHIEVEMENT);
  });

  it('should handle insufficient weapon data gracefully', () => {
    // Only 2 kills total -- not enough data
    const weaponKills: WeaponKillRow[] = [
      { weapon: 'R-301', kill_count: 2 },
    ];
    const ctx = createWeaponContext(weaponKills, 2);

    const results = rule.evaluatePostMatch(1, 1, ctx);

    // Should return empty (not enough data)
    expect(results).toHaveLength(0);
  });
});
