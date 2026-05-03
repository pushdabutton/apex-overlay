import { describe, it, expect } from 'vitest';
import { cleanLegendName, cleanWeaponName, percentChange, formatCompact, kdRatio, parseRankName, getRankInfo, rankColorClass, formatRankName } from '../../src/shared/utils';

describe('cleanLegendName', () => {
  it('should strip #character_ prefix and _NAME suffix', () => {
    expect(cleanLegendName('#character_wraith_NAME')).toBe('Wraith');
  });

  it('should handle multi-word legend names with underscores', () => {
    expect(cleanLegendName('#character_mad_maggie_NAME')).toBe('Mad Maggie');
  });

  it('should capitalize each word correctly', () => {
    expect(cleanLegendName('#character_horizon_NAME')).toBe('Horizon');
    expect(cleanLegendName('#character_octane_NAME')).toBe('Octane');
    expect(cleanLegendName('#character_lifeline_NAME')).toBe('Lifeline');
    expect(cleanLegendName('#character_bangalore_NAME')).toBe('Bangalore');
  });

  it('should pass through already-clean names unchanged', () => {
    expect(cleanLegendName('Wraith')).toBe('Wraith');
    expect(cleanLegendName('Horizon')).toBe('Horizon');
    expect(cleanLegendName('Mad Maggie')).toBe('Mad Maggie');
  });

  it('should return "Unknown" for empty string', () => {
    expect(cleanLegendName('')).toBe('Unknown');
  });

  it('should return "Unknown" for null-like values', () => {
    // TypeScript guards against null, but runtime could get empty
    expect(cleanLegendName('')).toBe('Unknown');
  });

  it('should handle edge case with only prefix (no _NAME suffix)', () => {
    // If only prefix matches but no _NAME suffix, still strip prefix
    expect(cleanLegendName('#character_wraith')).toBe('Wraith');
  });

  it('should handle edge case with only _NAME suffix (no #character_ prefix)', () => {
    // If only suffix matches, strip suffix but don't alter capitalization
    expect(cleanLegendName('wraith_NAME')).toBe('wraith_NAME');
  });

  it('should handle all-caps localization key', () => {
    // Some versions might send uppercase
    expect(cleanLegendName('#character_WRAITH_NAME')).toBe('Wraith');
  });

  it('should handle three-word legend names', () => {
    expect(cleanLegendName('#character_alter_ego_NAME')).toBe('Alter Ego');
  });
});

// ============================================================
// cleanWeaponName Tests
// ============================================================

describe('cleanWeaponName', () => {
  it('should return "Unknown" for null', () => {
    expect(cleanWeaponName(null)).toBe('Unknown');
  });

  it('should return "Unknown" for undefined', () => {
    expect(cleanWeaponName(undefined)).toBe('Unknown');
  });

  it('should return "Unknown" for empty string', () => {
    expect(cleanWeaponName('')).toBe('Unknown');
  });

  it('should return "Unknown" for whitespace-only string', () => {
    expect(cleanWeaponName('   ')).toBe('Unknown');
  });

  it('should pass through already-clean display names unchanged', () => {
    expect(cleanWeaponName('R-301 Carbine')).toBe('R-301 Carbine');
    expect(cleanWeaponName('RE-45 Auto')).toBe('RE-45 Auto');
    expect(cleanWeaponName('Peacekeeper')).toBe('Peacekeeper');
    expect(cleanWeaponName('Wingman')).toBe('Wingman');
    expect(cleanWeaponName('R-99')).toBe('R-99');
  });

  it('should strip #weapon_ localization prefix and map to display name', () => {
    expect(cleanWeaponName('#weapon_re45_auto')).toBe('RE-45 Auto');
    expect(cleanWeaponName('#weapon_r301_carbine')).toBe('R-301 Carbine');
    expect(cleanWeaponName('#weapon_alternator_smg')).toBe('Alternator SMG');
  });

  it('should strip #weapon_ prefix with _NAME suffix', () => {
    expect(cleanWeaponName('#weapon_re45_auto_NAME')).toBe('RE-45 Auto');
    expect(cleanWeaponName('#weapon_peacekeeper_NAME')).toBe('Peacekeeper');
  });

  it('should strip plain weapon_ prefix (internal engine name)', () => {
    expect(cleanWeaponName('weapon_re45_auto')).toBe('RE-45 Auto');
    expect(cleanWeaponName('weapon_r301_carbine')).toBe('R-301 Carbine');
  });

  it('should handle case-insensitive localization keys', () => {
    expect(cleanWeaponName('#WEAPON_RE45_AUTO')).toBe('RE-45 Auto');
    expect(cleanWeaponName('#Weapon_R301_Carbine')).toBe('R-301 Carbine');
  });

  it('should map known internal names to display names', () => {
    expect(cleanWeaponName('re45')).toBe('RE-45 Auto');
    expect(cleanWeaponName('r301')).toBe('R-301 Carbine');
    expect(cleanWeaponName('flatline')).toBe('VK-47 Flatline');
    expect(cleanWeaponName('car')).toBe('CAR SMG');
    expect(cleanWeaponName('mastiff')).toBe('Mastiff Shotgun');
    expect(cleanWeaponName('kraber')).toBe('Kraber .50-Cal Sniper');
    expect(cleanWeaponName('eva8')).toBe('EVA-8 Auto');
    expect(cleanWeaponName('longbow')).toBe('Longbow DMR');
    expect(cleanWeaponName('sentinel')).toBe('Sentinel');
  });

  it('should handle Melee as a special weapon', () => {
    expect(cleanWeaponName('melee')).toBe('Melee');
    expect(cleanWeaponName('Melee')).toBe('Melee');
  });

  it('should pass through unknown weapon names as-is', () => {
    // An unknown weapon that doesn't match any pattern should pass through
    expect(cleanWeaponName('Nemesis Burst AR')).toBe('Nemesis Burst AR');
    expect(cleanWeaponName('SomeNewWeapon')).toBe('SomeNewWeapon');
  });
});

// Verify existing utils still work (regression tests)
describe('existing utils regression', () => {
  it('percentChange handles zero previous', () => {
    expect(percentChange(5, 0)).toBe(100);
    expect(percentChange(0, 0)).toBe(0);
  });

  it('formatCompact handles various ranges', () => {
    expect(formatCompact(500)).toBe('500');
    expect(formatCompact(1500)).toBe('1.5K');
    expect(formatCompact(1_500_000)).toBe('1.5M');
  });

  it('kdRatio handles zero deaths', () => {
    expect(kdRatio(5, 0)).toBe('5.00');
    expect(kdRatio(0, 0)).toBe('0.00');
    expect(kdRatio(6, 3)).toBe('2.00');
  });
});

// ============================================================
// Rank Utility Tests
// ============================================================

describe('parseRankName', () => {
  it('should parse "Gold II" into tier Gold, division 2', () => {
    const result = parseRankName('Gold II');
    expect(result).toEqual({ tierName: 'Gold', division: 2 });
  });

  it('should parse "Bronze IV" into tier Bronze, division 4', () => {
    const result = parseRankName('Bronze IV');
    expect(result).toEqual({ tierName: 'Bronze', division: 4 });
  });

  it('should parse "Platinum I" into tier Platinum, division 1', () => {
    const result = parseRankName('Platinum I');
    expect(result).toEqual({ tierName: 'Platinum', division: 1 });
  });

  it('should parse numeric division "Gold 2"', () => {
    const result = parseRankName('Gold 2');
    expect(result).toEqual({ tierName: 'Gold', division: 2 });
  });

  it('should parse case-insensitive "gold ii"', () => {
    const result = parseRankName('gold ii');
    expect(result).toEqual({ tierName: 'Gold', division: 2 });
  });

  it('should parse "Master" without division', () => {
    const result = parseRankName('Master');
    expect(result).toEqual({ tierName: 'Master', division: 1 });
  });

  it('should parse "Predator" without division', () => {
    const result = parseRankName('Predator');
    expect(result).toEqual({ tierName: 'Predator', division: 1 });
  });

  it('should return null for empty string', () => {
    expect(parseRankName('')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(parseRankName('   ')).toBeNull();
  });

  it('should handle leading/trailing whitespace', () => {
    const result = parseRankName('  Gold II  ');
    expect(result).toEqual({ tierName: 'Gold', division: 2 });
  });
});

describe('getRankInfo', () => {
  // Tier RP floors (cumulative, Season 24):
  // Rookie: 0 (4 divs x 250 = 1000 total)
  // Bronze: 1000 (4 divs x 500 = 2000 total)
  // Silver: 3000 (4 divs x 600 = 2400 total)
  // Gold: 5400 (4 divs x 700 = 2800 total)
  // Platinum: 8200 (4 divs x 800 = 3200 total)
  // Diamond: 11400 (4 divs x 900 = 3600 total)
  // Master: 15000
  // Predator: 15000

  it('should calculate Gold II info correctly', () => {
    // Gold tier floor = 5400
    // Gold IV = 5400-6099, III = 6100-6799, II = 6800-7499, I = 7500-8199
    const info = getRankInfo('Gold II', 7339);
    expect(info).not.toBeNull();
    expect(info!.tierName).toBe('Gold');
    expect(info!.division).toBe(2);
    expect(info!.divisionFloor).toBe(6800);
    expect(info!.divisionCeiling).toBe(7500);
    expect(info!.tierColor).toBe('#ffd700');
  });

  it('should calculate Rookie IV (entry) correctly', () => {
    const info = getRankInfo('Rookie IV', 100);
    expect(info).not.toBeNull();
    expect(info!.tierName).toBe('Rookie');
    expect(info!.division).toBe(4);
    expect(info!.divisionFloor).toBe(0);
    expect(info!.divisionCeiling).toBe(250);
  });

  it('should calculate Bronze I correctly', () => {
    // Bronze tier floor = 1000
    // Bronze IV = 1000-1499, III = 1500-1999, II = 2000-2499, I = 2500-2999
    const info = getRankInfo('Bronze I', 2600);
    expect(info).not.toBeNull();
    expect(info!.divisionFloor).toBe(2500);
    expect(info!.divisionCeiling).toBe(3000);
    expect(info!.tierColor).toBe('#cd7f32');
  });

  it('should return null ceiling for Master', () => {
    const info = getRankInfo('Master', 18000);
    expect(info).not.toBeNull();
    expect(info!.tierName).toBe('Master');
    expect(info!.divisionCeiling).toBeNull();
    expect(info!.divisionFloor).toBe(15000);
    expect(info!.tierColor).toBe('#9b59b6');
  });

  it('should return null ceiling for Predator', () => {
    const info = getRankInfo('Predator', 25000);
    expect(info).not.toBeNull();
    expect(info!.tierName).toBe('Predator');
    expect(info!.divisionCeiling).toBeNull();
    expect(info!.tierColor).toBe('#e74c3c');
  });

  it('should return null for unrecognized tier', () => {
    expect(getRankInfo('Legendary', 5000)).toBeNull();
  });

  it('should return null for empty rank name', () => {
    expect(getRankInfo('', 5000)).toBeNull();
  });

  it('should calculate Alex real-world scenario: Gold II at 7339 RP', () => {
    // Regression test: Alex is Gold II with 7339 RP. The overlay must show
    // Gold II with a progress bar from 6800 to 7500, not Gold I with a maxed bar.
    const info = getRankInfo('Gold II', 7339);
    expect(info).not.toBeNull();
    expect(info!.tierName).toBe('Gold');
    expect(info!.division).toBe(2);
    expect(info!.divisionFloor).toBe(6800);
    expect(info!.divisionCeiling).toBe(7500);
    // Progress: (7339 - 6800) / (7500 - 6800) = 539/700 = ~77%
    const progress = (7339 - info!.divisionFloor) / (info!.divisionCeiling! - info!.divisionFloor);
    expect(progress).toBeGreaterThan(0.7);
    expect(progress).toBeLessThan(0.8);
  });
});

describe('rankColorClass', () => {
  it('should return correct Tailwind class for each tier', () => {
    expect(rankColorClass('Bronze')).toBe('text-rank-bronze');
    expect(rankColorClass('Silver')).toBe('text-rank-silver');
    expect(rankColorClass('Gold')).toBe('text-rank-gold');
    expect(rankColorClass('Platinum')).toBe('text-rank-platinum');
    expect(rankColorClass('Diamond')).toBe('text-rank-diamond');
    expect(rankColorClass('Master')).toBe('text-rank-master');
    expect(rankColorClass('Predator')).toBe('text-rank-predator');
  });

  it('should handle case-insensitive input', () => {
    expect(rankColorClass('gold')).toBe('text-rank-gold');
    expect(rankColorClass('GOLD')).toBe('text-rank-gold');
  });

  it('should return fallback for Rookie', () => {
    expect(rankColorClass('Rookie')).toBe('text-white/50');
  });

  it('should return fallback for unknown tier', () => {
    expect(rankColorClass('Unknown')).toBe('text-white/50');
  });
});

describe('formatRankName', () => {
  it('should combine tier and division into "Gold II" format', () => {
    expect(formatRankName('Gold', 2)).toBe('Gold II');
  });

  it('should format all four divisions correctly', () => {
    expect(formatRankName('Silver', 4)).toBe('Silver IV');
    expect(formatRankName('Silver', 3)).toBe('Silver III');
    expect(formatRankName('Silver', 2)).toBe('Silver II');
    expect(formatRankName('Silver', 1)).toBe('Silver I');
  });

  it('should return just tier name for Master', () => {
    expect(formatRankName('Master', 0)).toBe('Master');
    expect(formatRankName('Master', 1)).toBe('Master');
  });

  it('should return just tier name for Predator', () => {
    expect(formatRankName('Predator', 0)).toBe('Predator');
  });

  it('should normalize case of tier name', () => {
    expect(formatRankName('gold', 2)).toBe('Gold II');
    expect(formatRankName('GOLD', 2)).toBe('Gold II');
  });

  it('should return tier only when division is 0 or missing', () => {
    expect(formatRankName('Gold', 0)).toBe('Gold');
    expect(formatRankName('Bronze', -1)).toBe('Bronze');
    expect(formatRankName('Platinum', 5)).toBe('Platinum');
  });

  it('should return "Unknown" for empty tier name', () => {
    expect(formatRankName('', 2)).toBe('Unknown');
    expect(formatRankName('  ', 2)).toBe('Unknown');
  });

  it('should handle the real-world API response: Gold div 2 -> "Gold II"', () => {
    // This is exactly what the mozambiquehe.re API returns for Alex
    expect(formatRankName('Gold', 2)).toBe('Gold II');
  });
});
