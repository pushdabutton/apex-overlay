// ============================================================
// API Scheduler -- Manages polling intervals and rate limiting
// ============================================================

import type Database from 'better-sqlite3';
import type { MozambiqueClient } from './mozambique-client';
import { API_POLL_INTERVALS } from '../../shared/constants';
import { broadcastToAll } from '../windows';
import { IPC } from '../../shared/ipc-channels';

export class ApiScheduler {
  private client: MozambiqueClient;
  private db: Database.Database;
  private intervals: NodeJS.Timeout[] = [];
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_GAP_MS = 500; // Rate limit: 500ms between requests

  constructor(client: MozambiqueClient, db: Database.Database) {
    this.client = client;
    this.db = db;
  }

  async start(): Promise<void> {
    if (!this.client.isConfigured()) {
      console.log('[ApiScheduler] API not configured, skipping polling');
      return;
    }

    // Initial fetches
    await this.fetchAndBroadcastAll();

    // Set up polling intervals
    this.intervals.push(
      setInterval(() => this.fetchMapRotation(), API_POLL_INTERVALS.MAP_ROTATION),
    );
    this.intervals.push(
      setInterval(() => this.fetchCrafting(), API_POLL_INTERVALS.CRAFTING),
    );

    console.log('[ApiScheduler] Polling started');
  }

  stop(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    console.log('[ApiScheduler] Polling stopped');
  }

  /**
   * Call this between matches to refresh player profile.
   */
  async refreshPlayerProfile(): Promise<void> {
    await this.rateLimitedFetch(async () => {
      const playerName = this.getSetting('api.playerName');
      const platform = this.getSetting('api.platform') ?? 'PC';

      if (!playerName) return;

      const profile = await this.client.fetchPlayerProfile(playerName, platform);
      if (profile) {
        broadcastToAll(IPC.API_PLAYER_PROFILE, profile);
      }
    });
  }

  private async fetchAndBroadcastAll(): Promise<void> {
    await this.refreshPlayerProfile();
    await this.fetchMapRotation();
    await this.fetchCrafting();
  }

  private async fetchMapRotation(): Promise<void> {
    await this.rateLimitedFetch(async () => {
      const rotation = await this.client.fetchMapRotation();
      if (rotation) {
        broadcastToAll(IPC.API_MAP_ROTATION, rotation);
      }
    });
  }

  private async fetchCrafting(): Promise<void> {
    await this.rateLimitedFetch(async () => {
      const items = await this.client.fetchCraftingRotation();
      if (items) {
        broadcastToAll(IPC.API_CRAFTING, items);
      }
    });
  }

  private async rateLimitedFetch(fn: () => Promise<void>): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_GAP_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.MIN_REQUEST_GAP_MS - timeSinceLastRequest),
      );
    }

    this.lastRequestTime = Date.now();

    try {
      await fn();
    } catch (error) {
      console.error('[ApiScheduler] Fetch error:', error);
    }
  }

  private getSetting(key: string): string | null {
    try {
      const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row?.value ?? null;
    } catch {
      return null;
    }
  }
}
