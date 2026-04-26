// ============================================================
// GEP Manager -- RED Tests (TDD Phase 1)
// Tests for GEP lifecycle, feature registration with retry,
// and domain event emission
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GEPManager, type GEPProvider, GEP_REQUIRED_FEATURES } from '../gep-manager';

// ---------------------------------------------------------------------------
// Helpers: build a mock GEP provider that we control from tests
// ---------------------------------------------------------------------------
function createMockProvider(opts: {
  failUntilAttempt?: number;
} = {}): GEPProvider {
  let attempt = 0;
  const failUntil = opts.failUntilAttempt ?? 0;

  return {
    setRequiredFeatures: vi.fn(async (_features: string[]) => {
      attempt++;
      if (attempt <= failUntil) {
        return { success: false, supportedFeatures: [] };
      }
      return { success: true, supportedFeatures: [..._features] };
    }),
    onNewEvents: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInfoUpdates2: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };
}

describe('GEPManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Feature Registration with Retry
  // -----------------------------------------------------------------------

  it('should register required features with retry logic', async () => {
    const provider = createMockProvider({ failUntilAttempt: 2 });
    const mgr = new GEPManager(provider);

    // Start initialization (will be awaiting timers for retries)
    const initPromise = mgr.initialize();

    // Advance past 2 retry delays (3s each)
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);

    const success = await initPromise;
    expect(success).toBe(true);
    expect(provider.setRequiredFeatures).toHaveBeenCalledTimes(3);
    expect(provider.setRequiredFeatures).toHaveBeenCalledWith(GEP_REQUIRED_FEATURES);
  });

  it('should succeed on first attempt when provider succeeds immediately', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);

    const success = await mgr.initialize();
    expect(success).toBe(true);
    expect(provider.setRequiredFeatures).toHaveBeenCalledTimes(1);
  });

  it('should handle GEP registration failure after max retries', async () => {
    // Fail on all 10 attempts
    const provider = createMockProvider({ failUntilAttempt: 20 });
    const mgr = new GEPManager(provider);

    const initPromise = mgr.initialize();

    // Advance through all 10 retries (9 delays of 3s each -- first attempt has no delay)
    for (let i = 0; i < 9; i++) {
      await vi.advanceTimersByTimeAsync(3000);
    }

    const success = await initPromise;
    expect(success).toBe(false);
    expect(provider.setRequiredFeatures).toHaveBeenCalledTimes(10);
  });

  // -----------------------------------------------------------------------
  // Domain Event Emission
  // -----------------------------------------------------------------------

  it('should emit domain events when GEP fires kill event', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    const events: unknown[] = [];
    mgr.on('domain-event', (e: unknown) => events.push(e));

    // Capture the listener that was registered on the provider
    const onNewEventsListener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // Simulate a kill event from GEP
    onNewEventsListener({
      events: [{ name: 'kill', data: JSON.stringify({ victimName: 'Enemy1', weapon: 'R-301', headshot: true }) }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'PLAYER_KILL',
      victim: 'Enemy1',
      weapon: 'R-301',
      headshot: true,
    });
  });

  it('should emit domain events when GEP fires death event', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    const events: unknown[] = [];
    mgr.on('domain-event', (e: unknown) => events.push(e));

    const listener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    listener({
      events: [{ name: 'death', data: JSON.stringify({ attackerName: 'Attacker1', weapon: 'Kraber' }) }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'PLAYER_DEATH',
      attacker: 'Attacker1',
      weapon: 'Kraber',
    });
  });

  it('should emit domain events when GEP fires damage event', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    const events: unknown[] = [];
    mgr.on('domain-event', (e: unknown) => events.push(e));

    const listener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    listener({
      events: [{ name: 'damage', data: JSON.stringify({ damageAmount: '150', targetName: 'Enemy2', weapon: 'Flatline' }) }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'DAMAGE_DEALT',
      amount: 150,
      target: 'Enemy2',
      weapon: 'Flatline',
    });
  });

  it('should emit domain events when GEP fires match_start event', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    const events: unknown[] = [];
    mgr.on('domain-event', (e: unknown) => events.push(e));

    const listener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    listener({
      events: [{ name: 'match_start', data: JSON.stringify({ mode: 'ranked' }) }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'MATCH_START',
      mode: 'ranked',
    });
  });

  it('should emit domain events when GEP fires match_end event', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    const events: unknown[] = [];
    mgr.on('domain-event', (e: unknown) => events.push(e));

    const listener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    listener({
      events: [{ name: 'match_end', data: JSON.stringify({}) }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'MATCH_END',
    });
  });

  // -----------------------------------------------------------------------
  // Match State Tracking
  // -----------------------------------------------------------------------

  it('should track match state transitions (IDLE -> IN_MATCH -> MATCH_ENDED)', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    expect(mgr.getMatchState()).toBe('IDLE');

    const listener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // Start match
    listener({
      events: [{ name: 'match_start', data: JSON.stringify({ mode: 'battle_royale' }) }],
    });
    expect(mgr.getMatchState()).toBe('IN_MATCH');

    // End match
    listener({
      events: [{ name: 'match_end', data: JSON.stringify({}) }],
    });
    expect(mgr.getMatchState()).toBe('MATCH_ENDED');
  });

  it('should return to IDLE after match ended is acknowledged', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    const listener = (provider.onNewEvents.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];

    listener({
      events: [{ name: 'match_start', data: JSON.stringify({ mode: 'battle_royale' }) }],
    });
    listener({
      events: [{ name: 'match_end', data: JSON.stringify({}) }],
    });

    // Acknowledge / return to lobby
    mgr.returnToIdle();
    expect(mgr.getMatchState()).toBe('IDLE');
  });

  // -----------------------------------------------------------------------
  // Teardown
  // -----------------------------------------------------------------------

  it('should remove event listeners on destroy', async () => {
    const provider = createMockProvider();
    const mgr = new GEPManager(provider);
    await mgr.initialize();

    mgr.destroy();

    expect(provider.onNewEvents.removeListener).toHaveBeenCalled();
    expect(provider.onInfoUpdates2.removeListener).toHaveBeenCalled();
  });
});
