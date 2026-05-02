// ============================================================
// mozambiquehe.re API Client
// Player stats, map rotation, and crafting rotation
// ============================================================

import type Database from 'better-sqlite3';
import type { MapRotation, CraftingItem, PlayerProfile } from '../../shared/types';

const BASE_URL = 'https://api.mozambiquehe.re';
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

export class MozambiqueClient {
  private db: Database.Database;
  private apiKey: string | null = null;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(db: Database.Database) {
    this.db = db;
    this.loadApiKey();
  }

  private loadApiKey(): void {
    try {
      const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('api.key') as
        | { value: string }
        | undefined;
      this.apiKey = row?.value ?? null;
    } catch {
      // Settings table may not exist yet during first run
      this.apiKey = null;
    }
    // Fallback: check environment variable if DB has no key
    if (!this.apiKey && process.env.MOZAMBIQUE_API_KEY) {
      this.apiKey = process.env.MOZAMBIQUE_API_KEY;
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Fetch player profile and stats.
   */
  async fetchPlayerProfile(playerName: string, platform: string): Promise<PlayerProfile | null> {
    if (!this.apiKey) return null;

    const cacheKey = `profile:${platform}:${playerName}`;
    const cached = this.getFromCache<PlayerProfile>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/bridge?player=${encodeURIComponent(playerName)}&platform=${platform}&auth=${this.apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        console.error(`[API] Player profile fetch failed: ${response.status}`);
        return null;
      }

      const data = await response.json();

      const profile: PlayerProfile = {
        platform,
        playerName: data.global?.name ?? playerName,
        uid: data.global?.uid?.toString() ?? '',
        level: data.global?.level ?? 0,
        rankName: data.global?.rank?.rankName ?? 'Unknown',
        rankScore: data.global?.rank?.rankScore ?? 0,
        rankDivision: data.global?.rank?.rankDiv ?? 0,
      };

      // Cache in memory
      this.setCache(cacheKey, profile, 5 * 60 * 1000);

      // UPSERT into SQLite for offline access -- keeps only the latest
      // profile per (platform, player_uid) to prevent unbounded growth.
      this.db.prepare(`
        INSERT INTO player_profile (platform, player_name, player_uid, level, rank_name, rank_score, rank_division, data_json, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(platform, player_uid) DO UPDATE SET
          player_name = excluded.player_name,
          level = excluded.level,
          rank_name = excluded.rank_name,
          rank_score = excluded.rank_score,
          rank_division = excluded.rank_division,
          data_json = excluded.data_json,
          fetched_at = excluded.fetched_at
      `).run(
        profile.platform,
        profile.playerName,
        profile.uid,
        profile.level,
        profile.rankName,
        profile.rankScore,
        profile.rankDivision,
        JSON.stringify(data),
      );

      return profile;
    } catch (error) {
      console.error('[API] Player profile fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch current map rotation.
   */
  async fetchMapRotation(): Promise<MapRotation | null> {
    if (!this.apiKey) return null;

    const cacheKey = 'map-rotation';
    const cached = this.getFromCache<MapRotation>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/maprotation?version=2&auth=${this.apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        console.error(`[API] Map rotation fetch failed: ${response.status}`);
        return null;
      }

      const data = await response.json();

      const rotation: MapRotation = {
        current: {
          map: data.battle_royale?.current?.map ?? 'Unknown',
          remainingTimer: data.battle_royale?.current?.remainingSecs ?? 0,
          asset: data.battle_royale?.current?.asset ?? '',
        },
        next: {
          map: data.battle_royale?.next?.map ?? 'Unknown',
          durationMinutes: data.battle_royale?.next?.DurationInMinutes ?? 0,
        },
      };

      this.setCache(cacheKey, rotation, 60 * 1000);
      return rotation;
    } catch (error) {
      console.error('[API] Map rotation fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch current crafting rotation.
   */
  async fetchCraftingRotation(): Promise<CraftingItem[] | null> {
    if (!this.apiKey) return null;

    const cacheKey = 'crafting';
    const cached = this.getFromCache<CraftingItem[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/crafting?auth=${this.apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        console.error(`[API] Crafting fetch failed: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Flatten the crafting rotation into a simple item list
      const items: CraftingItem[] = [];
      if (Array.isArray(data)) {
        for (const bundle of data) {
          if (bundle.bundleContent && Array.isArray(bundle.bundleContent)) {
            for (const item of bundle.bundleContent) {
              items.push({
                item: item.itemType?.name ?? 'Unknown',
                cost: item.cost ?? 0,
                itemType: {
                  name: item.itemType?.name ?? 'Unknown',
                  rarity: item.itemType?.rarity ?? 'Common',
                },
              });
            }
          }
        }
      }

      this.setCache(cacheKey, items, 5 * 60 * 1000);
      return items;
    } catch (error) {
      console.error('[API] Crafting fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch the currently selected legend for a player from the API.
   * Uses the bridge endpoint and extracts realtime.selectedLegend.
   *
   * @param playerName - The player's in-game name
   * @param platform - Platform identifier (default: 'PC')
   * @returns The legend name (e.g., "Lifeline") or null on error/not found
   */
  async getSelectedLegend(playerName: string, platform: string = 'PC'): Promise<string | null> {
    if (!this.apiKey) return null;

    try {
      const url = `${BASE_URL}/bridge?player=${encodeURIComponent(playerName)}&platform=${platform}&auth=${this.apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        console.error(`[API] getSelectedLegend fetch failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const selectedLegend = data?.global?.legends?.selected?.LegendName
        ?? data?.realtime?.selectedLegend
        ?? null;

      if (selectedLegend && typeof selectedLegend === 'string') {
        console.log(`[LEGEND-HUNT] mozambique API selectedLegend: "${selectedLegend}"`);
        return selectedLegend;
      }

      console.log('[LEGEND-HUNT] mozambique API: no selectedLegend in response');
      return null;
    } catch (error) {
      console.error('[API] getSelectedLegend error:', error);
      return null;
    }
  }

  /**
   * Delete player_profile rows older than the given number of days.
   * Keeps the latest profile per player (UPSERT handles that),
   * but this cleans up any stale rows from before the UPSERT fix.
   */
  pruneOldProfiles(daysOld: number = 30): number {
    try {
      const result = this.db.prepare(
        `DELETE FROM player_profile WHERE fetched_at < datetime('now', '-' || ? || ' days')`,
      ).run(daysOld);
      return result.changes;
    } catch {
      return 0;
    }
  }

  // --- Network helpers ---

  /**
   * fetch() wrapper with an AbortController timeout (default 10s).
   * Prevents hung requests from blocking the event loop.
   */
  private async fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Cache helpers ---

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, fetchedAt: Date.now(), ttlMs });
  }
}
