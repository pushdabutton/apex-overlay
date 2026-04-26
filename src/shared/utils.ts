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
