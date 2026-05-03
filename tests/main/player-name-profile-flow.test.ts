// ============================================================
// Integration: Player Name from GEP -> API Profile Fetch
//
// Verifies that when EventProcessor emits 'player-name', the
// main process wiring calls apiScheduler.refreshPlayerProfile()
// with that name, triggering a profile fetch and rank broadcast.
//
// This tests the wiring logic that should exist in index.ts,
// but we test it as a unit by simulating the same wiring pattern.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventProcessor } from '../../src/main/gep/event-processor';
import { ApiScheduler } from '../../src/main/api/api-scheduler';
import type { MozambiqueClient } from '../../src/main/api/mozambique-client';
import type { PlayerProfile } from '../../src/shared/types';

function createMockClient(overrides: Partial<MozambiqueClient> = {}): MozambiqueClient {
  return {
    isConfigured: vi.fn().mockReturnValue(true),
    fetchPlayerProfile: vi.fn().mockResolvedValue(null),
    fetchMapRotation: vi.fn().mockResolvedValue(null),
    fetchCraftingRotation: vi.fn().mockResolvedValue(null),
    getSelectedLegend: vi.fn().mockResolvedValue(null),
    pruneOldProfiles: vi.fn(),
    ...overrides,
  } as unknown as MozambiqueClient;
}

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
  } as unknown as import('better-sqlite3').Database;
}

const MOCK_PROFILE: PlayerProfile = {
  name: 'ipushdabutton',
  platform: 'PC',
  level: 500,
  rankName: 'Gold IV',
  rankScore: 4200,
  legendPlayed: 'Wraith',
  bannerUrl: null,
  avatarUrl: null,
  lastUpdated: new Date().toISOString(),
};

describe('Player name GEP -> profile fetch flow', () => {
  let processor: EventProcessor;
  let scheduler: ApiScheduler;
  let mockClient: MozambiqueClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient({
      fetchPlayerProfile: vi.fn().mockResolvedValue(MOCK_PROFILE),
    });
    const mockDb = createMockDb();
    processor = new EventProcessor();
    scheduler = new ApiScheduler(mockClient, mockDb);

    // Wire the player-name event to the scheduler, exactly as index.ts should
    processor.on('player-name', (name: string) => {
      scheduler.refreshPlayerProfile(name);
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
    processor.removeAllListeners();
  });

  it('should trigger profile fetch when GEP sends player name via "name" key', async () => {
    processor.processInfoUpdate({
      info: { key: 'name', value: 'ipushdabutton', feature: 'me', category: 'me' },
    });

    // Let promises resolve
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('ipushdabutton', 'PC');
  });

  it('should trigger profile fetch when player name comes from "player" key', async () => {
    processor.processInfoUpdate({
      info: {
        key: 'player',
        value: { player_name: 'SomePlayer', in_game_player_name: 'SomePlayer' },
        feature: 'game_info',
        category: 'game_info',
      },
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('SomePlayer', 'PC');
  });

  it('should invoke profile callback with rank data when profile is fetched', async () => {
    const profileCallback = vi.fn();
    scheduler.onPlayerProfile(profileCallback);

    processor.processInfoUpdate({
      info: { key: 'name', value: 'ipushdabutton', feature: 'me', category: 'me' },
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(profileCallback).toHaveBeenCalledWith(MOCK_PROFILE);
  });

  it('should not fetch profile if player name is empty string', async () => {
    processor.processInfoUpdate({
      info: { key: 'name', value: '', feature: 'me', category: 'me' },
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockClient.fetchPlayerProfile).not.toHaveBeenCalled();
  });
});
