// ============================================================
// Post-Match Rank Refresh Tests
//
// Problem: The overlay shows stale RP because the mozambiquehe.re
// API caches player data. After a match ends, the rank changes
// but the overlay still shows the old value until the next 5-min poll.
//
// Fix: After MATCH_END, trigger a delayed profile refresh that
// bypasses the in-memory cache to get fresh data from the API.
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
    clearProfileCache: vi.fn(),
    ...overrides,
  } as unknown as MozambiqueClient;
}

// Create a mock DB
function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
  } as unknown as import('better-sqlite3').Database;
}

const STALE_PROFILE: PlayerProfile = {
  platform: 'PC',
  playerName: 'ipushdabutton',
  uid: '12345',
  level: 500,
  rankName: 'Gold',
  rankScore: 7339,
  rankDivision: 2,
};

const FRESH_PROFILE: PlayerProfile = {
  platform: 'PC',
  playerName: 'ipushdabutton',
  uid: '12345',
  level: 500,
  rankName: 'Gold',
  rankScore: 7353, // +14 RP after match
  rankDivision: 2,
};

describe('ApiScheduler: post-match rank refresh (skipCache)', () => {
  let scheduler: ApiScheduler;
  let mockClient: MozambiqueClient;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient({
      fetchPlayerProfile: vi.fn().mockResolvedValue(FRESH_PROFILE),
    });
    mockDb = createMockDb();
    scheduler = new ApiScheduler(mockClient, mockDb);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('should pass skipCache=true to fetchPlayerProfile when refreshPlayerProfile is called with skipCache', async () => {
    await scheduler.refreshPlayerProfile('ipushdabutton', true);

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('ipushdabutton', 'PC', true);
  });

  it('should NOT pass skipCache when called without it (normal polling)', async () => {
    await scheduler.refreshPlayerProfile('ipushdabutton');

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('ipushdabutton', 'PC');
  });

  it('should notify profile callbacks even on cache-skipped fetches', async () => {
    const callback = vi.fn();
    scheduler.onPlayerProfile(callback);

    await scheduler.refreshPlayerProfile('ipushdabutton', true);

    expect(callback).toHaveBeenCalledWith(FRESH_PROFILE);
  });

  it('should use cached player name when skipCache=true but no name provided', async () => {
    // First call sets the cached name
    await scheduler.refreshPlayerProfile('ipushdabutton');
    vi.clearAllMocks();
    await vi.advanceTimersByTimeAsync(600);

    // Second call: no name, but skipCache=true -- should use cached name
    await scheduler.refreshPlayerProfile(undefined, true);

    expect(mockClient.fetchPlayerProfile).toHaveBeenCalledWith('ipushdabutton', 'PC', true);
  });
});

describe('MozambiqueClient: skipCache parameter', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should bypass cache when skipCache=true is passed', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          global: {
            name: 'TestPlayer',
            uid: 12345,
            level: 500,
            rank: { rankName: 'Gold', rankScore: callCount === 1 ? 7339 : 7353, rankDiv: 2 },
          },
        })),
      });
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ value: 'test-key' }),
        run: vi.fn(),
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(mockDb as any);

    // First call -- caches the result
    const first = await client.fetchPlayerProfile('TestPlayer', 'PC');
    expect(first?.rankScore).toBe(7339);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second call without skipCache -- should return cached value (no new fetch)
    const second = await client.fetchPlayerProfile('TestPlayer', 'PC');
    expect(second?.rankScore).toBe(7339);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // Still 1 -- cache hit

    // Third call WITH skipCache -- should make a new fetch
    const third = await client.fetchPlayerProfile('TestPlayer', 'PC', true);
    expect(third?.rankScore).toBe(7353);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // Now 2 -- cache bypassed
  });

  it('should update cache after a skipCache fetch so subsequent normal reads get fresh data', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          global: {
            name: 'TestPlayer',
            uid: 12345,
            level: 500,
            rank: { rankName: 'Gold', rankScore: 7300 + callCount * 50, rankDiv: 2 },
          },
        })),
      });
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ value: 'test-key' }),
        run: vi.fn(),
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(mockDb as any);

    // First: populate cache
    await client.fetchPlayerProfile('TestPlayer', 'PC');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second: skipCache fetch gets fresh data and updates cache
    const fresh = await client.fetchPlayerProfile('TestPlayer', 'PC', true);
    expect(fresh?.rankScore).toBe(7400); // 7300 + 2*50
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Third: normal fetch should return the new cached value (no new fetch)
    const cached = await client.fetchPlayerProfile('TestPlayer', 'PC');
    expect(cached?.rankScore).toBe(7400); // Same as fresh
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // No new fetch
  });
});

describe('MozambiqueClient: clearProfileCache', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should clear the profile cache for a given player', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        global: {
          name: 'TestPlayer',
          uid: 12345,
          level: 500,
          rank: { rankName: 'Gold', rankScore: 7339, rankDiv: 2 },
        },
      })),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ value: 'test-key' }),
        run: vi.fn(),
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(mockDb as any);

    // Populate cache
    await client.fetchPlayerProfile('TestPlayer', 'PC');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Clear cache
    client.clearProfileCache('TestPlayer', 'PC');

    // Next fetch should hit the API again
    await client.fetchPlayerProfile('TestPlayer', 'PC');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
