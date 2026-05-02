// ============================================================
// Pure Utility Functions -- No side effects, no dependencies
// ============================================================

/**
 * Calculate percentage change between two values.
 * Returns 0 if previous is 0 (avoids division by zero).
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format a number with K/M suffix for compact display.
 * e.g., 1234 -> "1.2K", 1234567 -> "1.2M"
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

/**
 * Format seconds into mm:ss or hh:mm:ss string.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Calculate KD ratio, returns "N/A" string if no deaths.
 */
export function kdRatio(kills: number, deaths: number): string {
  if (deaths === 0) return kills > 0 ? `${kills}.00` : '0.00';
  return (kills / deaths).toFixed(2);
}

/**
 * Calculate accuracy percentage from shots hit/fired.
 */
export function accuracy(shotsHit: number, shotsFired: number): number {
  if (shotsFired === 0) return 0;
  return (shotsHit / shotsFired) * 100;
}

/**
 * Get ISO 8601 timestamp string for current time.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clean a GEP legend name by stripping the Apex localization key format.
 *
 * Raw GEP sends legend names as localization keys like:
 *   "#character_wraith_NAME"  -> "Wraith"
 *   "#character_horizon_NAME" -> "Horizon"
 *   "#character_mad_maggie_NAME" -> "Mad Maggie"
 *
 * Also handles already-clean names (pass-through) and empty/null values.
 */
export function cleanLegendName(raw: string): string {
  if (!raw || raw.length === 0) return 'Unknown';

  // Strip the localization key format: #character_XXXX_NAME
  // Only strip _NAME suffix if the #character_ prefix was present
  // (they always appear together in GEP data)
  let cleaned = raw;
  if (cleaned.startsWith('#character_')) {
    cleaned = cleaned.slice('#character_'.length);
    if (cleaned.endsWith('_NAME')) {
      cleaned = cleaned.slice(0, -'_NAME'.length);
    }
    // Capitalize each word (underscores become spaces)
    cleaned = cleaned
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  return cleaned || 'Unknown';
}

// ============================================================
// Rank Utilities -- Parse rank names and calculate RP progress
// ============================================================

import { RANK_TIERS } from './constants';

export interface RankInfo {
  tierName: string;
  division: number;
  tierColor: string;
  divisionFloor: number;
  divisionCeiling: number | null; // null for Master/Predator (no ceiling)
}

/**
 * Parse a rank name string like "Gold II" into tier + division.
 * Returns tier name and division number (1-4, where 4 is lowest / entry).
 * Master and Predator have no divisions (returns division 1).
 *
 * Handles formats: "Gold II", "Gold 2", "gold ii", "GOLD II", "Gold"
 */
export function parseRankName(rankName: string): { tierName: string; division: number } | null {
  if (!rankName || rankName.trim().length === 0) return null;

  const trimmed = rankName.trim();

  // Roman numeral map
  const romanMap: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

  // Try to match "TierName Division" pattern
  const match = trimmed.match(/^(\w+)\s+([IV]+|\d)$/i);
  if (match) {
    const tierName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const divStr = match[2].toUpperCase();
    const division = romanMap[divStr] ?? parseInt(divStr, 10);
    if (isNaN(division) || division < 1 || division > 4) return null;
    return { tierName, division };
  }

  // No division specified -- Master/Predator or standalone tier name
  const tierName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return { tierName, division: 1 };
}

/**
 * Calculate full rank info from rankName and rankScore.
 * Uses RANK_TIERS to compute division floor/ceiling for the progress bar.
 *
 * Returns null if rank cannot be parsed or is not a recognized tier.
 */
export function getRankInfo(rankName: string, rankScore: number): RankInfo | null {
  const parsed = parseRankName(rankName);
  if (!parsed) return null;

  const tier = RANK_TIERS.find(
    (t) => t.name.toLowerCase() === parsed.tierName.toLowerCase(),
  );
  if (!tier) return null;

  // Master and Predator have no divisions or RP ceiling
  if (tier.rpPerDivision === null) {
    // Calculate tier floor: sum of all lower tiers
    let floor = 0;
    for (const t of RANK_TIERS) {
      if (t.name === tier.name) break;
      floor += t.divisions * (t.rpPerDivision ?? 0);
    }
    return {
      tierName: tier.name,
      division: 1,
      tierColor: tier.color,
      divisionFloor: floor,
      divisionCeiling: null,
    };
  }

  // Calculate the RP floor for this tier
  let tierFloor = 0;
  for (const t of RANK_TIERS) {
    if (t.name === tier.name) break;
    tierFloor += t.divisions * (t.rpPerDivision ?? 0);
  }

  // Divisions count DOWN: IV is lowest (entry), I is highest.
  // Division IV starts at tierFloor, III at tierFloor + rpPerDivision, etc.
  // So division N starts at: tierFloor + (4 - division) * rpPerDivision
  const divIndex = tier.divisions - parsed.division; // 0 for div IV, 3 for div I
  const divisionFloor = tierFloor + divIndex * tier.rpPerDivision;
  const divisionCeiling = divisionFloor + tier.rpPerDivision;

  return {
    tierName: tier.name,
    division: parsed.division,
    tierColor: tier.color,
    divisionFloor,
    divisionCeiling,
  };
}

/**
 * Map a tier name to a Tailwind rank color class name.
 * Falls back to white/50 for unknown tiers.
 */
export function rankColorClass(tierName: string): string {
  const map: Record<string, string> = {
    rookie: 'text-white/50',
    bronze: 'text-rank-bronze',
    silver: 'text-rank-silver',
    gold: 'text-rank-gold',
    platinum: 'text-rank-platinum',
    diamond: 'text-rank-diamond',
    master: 'text-rank-master',
    predator: 'text-rank-predator',
  };
  return map[tierName.toLowerCase()] ?? 'text-white/50';
}
