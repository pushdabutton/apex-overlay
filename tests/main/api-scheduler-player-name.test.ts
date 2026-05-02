// ============================================================
// ApiScheduler: Player Name from GEP -> Profile Fetch Tests
//
// Root cause: refreshPlayerProfile() reads api.playerName from
// the settings DB. This setting is never populated, so profile
// fetch silently skips -- no rank data ever reaches the UI.
//
// Fix: Accept an optional playerName parameter from GEP and
// cache it for subsequent polling calls.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiScheduler } from '../../src/main/api/api-scheduler';
import type { MozambiqueClient } from '../../src/main/api/mozambique-client';
import type { PlayerProfile } from '../../src/shared/types';

// Create a mock MozambiqueClient
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

// Create a mock DB
function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined), // No settings in DB
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

describe('ApiScheduler: player name from GEP', () => {
  let scheduler: ApiScheduler;
  let mockClient: MozambiqueClient;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient({
      fetchPlayerProfile: vi.fn().mockResolvedValue(MOCK_PROFILE),
    });
    mockDb = createMockDb();
    scheduler = new ApiScheduler(mockClient, mockDb);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('should fetch profile when refreshPlayerProfile is called with a player name', async () => {
    await scheduler.refreshPlayerProfile('ipushdabutton');

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('ipushdabutton', 'PC');
  });

  it('should cache player name and reuse it on subsequent calls without a name', async () => {
    // First call: provide name
    await scheduler.refreshPlayerProfile('ipushdabutton');
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledTimes(1);

    // Advance past rate limit gap so the next call doesn't block on setTimeout
    await vi.advanceTimersByTimeAsync(600);

    // Second call: no name, should use cached
    await scheduler.refreshPlayerProfile();
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledTimes(2);
    expect(mockClient.fetchPlayerProfile).toHaveBeenLastCalledWith('ipushdabutton', 'PC');
  });

  it('should skip fetch when no player name is available (no param, no cache, no DB)', async () => {
    // No name param, no cached name, DB returns undefined
    await scheduler.refreshPlayerProfile();

    expect(mockClient.fetchPlayerProfile).not.toHaveBeenCalled();
  });

  it('should update cached name when a new name is provided', async () => {
    await scheduler.refreshPlayerProfile('OldName');
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('OldName', 'PC');

    // Advance past rate limit gap
    await vi.advanceTimersByTimeAsync(600);

    await scheduler.refreshPlayerProfile('NewName');
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('NewName', 'PC');
  });

  it('should notify profile callbacks when profile is fetched', async () => {
    const callback = vi.fn();
    scheduler.onPlayerProfile(callback);

    await scheduler.refreshPlayerProfile('ipushdabutton');

    expect(callback).toHaveBeenCalledWith(MOCK_PROFILE);
  });

  it('should fall back to DB setting when no cached name and no param', async () => {
    // Simulate DB returning a playerName
    const dbWithSetting = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'api.playerName') return { value: 'DBPlayer' };
          if (key === 'api.platform') return { value: 'PS4' };
          return undefined;
        }),
        run: vi.fn(),
        all: vi.fn().mockReturnValue([]),
      }),
    } as unknown as import('better-sqlite3').Database;

    const schedulerWithDb = new ApiScheduler(mockClient, dbWithSetting);
    await schedulerWithDb.refreshPlayerProfile();

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('DBPlayer', 'PS4');
    schedulerWithDb.stop();
  });
});

describe('ApiScheduler: periodic profile polling', () => {
  let scheduler: ApiScheduler;
  let mockClient: MozambiqueClient;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient({
      fetchPlayerProfile: vi.fn().mockResolvedValue(MOCK_PROFILE),
    });
    mockDb = createMockDb();
    scheduler = new ApiScheduler(mockClient, mockDb);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('should set up periodic profile polling when started with a cached name', async () => {
    // Pre-seed the player name
    await scheduler.refreshPlayerProfile('ipushdabutton');
    await vi.advanceTimersByTimeAsync(600); // Clear rate limit gap
    vi.clearAllMocks();

    // Start scheduler -- fetchAndBroadcastAll does 3 sequential rate-limited calls.
    // We need to run it concurrently with timer advancement.
    const startPromise = scheduler.start();
    // Advance enough time for rate-limit delays between the 3 initial fetches
    await vi.advanceTimersByTimeAsync(2000);
    await startPromise;

    // Initial fetch
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledTimes(1);

    // Advance to first poll interval (5 minutes)
    await vi.advanceTimersByTimeAsync(300_000);

    // Should have polled again
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledTimes(2);
  });

  it('should include profile polling interval alongside map and crafting', async () => {
    await scheduler.refreshPlayerProfile('ipushdabutton');
    await vi.advanceTimersByTimeAsync(600);
    vi.clearAllMocks();

    const startPromise = scheduler.start();
    await vi.advanceTimersByTimeAsync(2000);
    await startPromise;

    // Initial fetches: profile, map, crafting
    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledTimes(1);
    expect(mockClient.fetchMapRotation).toHaveBeenCalledTimes(1);
    expect(mockClient.fetchCraftingRotation).toHaveBeenCalledTimes(1);

    // After 5 minutes: profile + crafting should poll
    // Each poll is rate-limited, so advance enough time for all to complete
    await vi.advanceTimersByTimeAsync(300_000);

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledTimes(2);
    expect(mockClient.fetchCraftingRotation).toHaveBeenCalledTimes(2);
  });

  it('should stop all polling intervals including profile on stop()', async () => {
    await scheduler.refreshPlayerProfile('ipushdabutton');
    await vi.advanceTimersByTimeAsync(600);

    const startPromise = scheduler.start();
    await vi.advanceTimersByTimeAsync(2000);
    await startPromise;
    vi.clearAllMocks();

    scheduler.stop();

    // Advance time -- no more calls should happen
    await vi.advanceTimersByTimeAsync(600_000);

    expect(mockClient.fetchPlayerProfile).not.toHaveBeenCalled();
    expect(mockClient.fetchMapRotation).not.toHaveBeenCalled();
  });
});
