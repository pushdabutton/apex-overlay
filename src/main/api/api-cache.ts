// ============================================================
// API Cache Layer -- In-memory + SQLite fallback
// ============================================================

export interface CacheConfig {
  ttlMs: number;
  staleWhileRevalidate: boolean;
}

export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  playerProfile: { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true },
  mapRotation: { ttlMs: 60 * 1000, staleWhileRevalidate: true },
  crafting: { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: false },
};

// Cache implementation is integrated directly into MozambiqueClient.
// This file provides the configuration constants and can be extended
// for more sophisticated caching strategies in Phase 2.
