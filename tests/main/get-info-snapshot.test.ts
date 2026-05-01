// ============================================================
// getInfo() Retroactive Snapshot Tests
//
// When the overlay starts after legend selection (or setRequiredFeatures
// completes after legendSelect_X already fired), gep.getInfo(gameId)
// provides a snapshot of ALL current game info. The adapter must:
//
// 1. Call getInfo() after setRequiredFeatures succeeds in game-detected
// 2. Recursively find legendSelect_X keys in the snapshot
// 3. Emit them as info update callbacks so EventProcessor processes them
// 4. Handle null/empty/malformed snapshots gracefully
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APEX_GAME_ID } from '../../src/shared/constants';

// ---------------------------------------------------------------
// Minimal mock types matching what OwElectronGEPAdapter expects
// ---------------------------------------------------------------

interface MockGepPackage {
  setRequiredFeatures: ReturnType<typeof vi.fn>;
  getInfo: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
}

function createMockGep(): MockGepPackage {
  return {
    setRequiredFeatures: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

/**
 * Helper: trigger a game-detected event on the mock.
 * The adapter registers a handler for 'game-detected' during construction.
 */
function triggerGameDetected(mockGep: MockGepPackage, gameId: number = APEX_GAME_ID): void {
  const gameDetectedCalls = mockGep.on.mock.calls.filter(
    (c: unknown[]) => c[0] === 'game-detected'
  );
  for (const call of gameDetectedCalls) {
    const handler = call[1] as (e: { enable(): void }, gameId: number, name: string, info: unknown) => void;
    handler({ enable: vi.fn() }, gameId, 'Apex Legends', {});
  }
}

/**
 * Helper: register an info update listener on the adapter's provider.
 * Returns the callback so we can inspect what it received.
 */
function registerInfoListener(
  provider: { onInfoUpdates2: { addListener: (cb: (payload: { info: Record<string, unknown> }) => void) => void } }
): Array<{ info: Record<string, unknown> }> {
  const received: Array<{ info: Record<string, unknown> }> = [];
  provider.onInfoUpdates2.addListener((payload: { info: Record<string, unknown> }) => {
    received.push(payload);
  });
  return received;
}

// ---------------------------------------------------------------
// Import the adapter (dynamically to control mock injection)
// ---------------------------------------------------------------
// The adapter is imported inline so we test the real implementation.

// We need to import OwElectronGEPAdapter. Since its constructor takes the
// OwGepPackage interface, our mock satisfies it.
import { OwElectronGEPAdapter } from '../../src/main/gep/ow-electron-adapter';

describe('getInfo() retroactive snapshot', () => {
  let mockGep: MockGepPackage;

  beforeEach(() => {
    mockGep = createMockGep();
  });

  // ------------------------------------------------------------------
  // Test 1: getInfo() is called after setRequiredFeatures succeeds
  // ------------------------------------------------------------------
  it('should call getInfo() after setRequiredFeatures succeeds in game-detected', async () => {
    // Arrange: setRequiredFeatures resolves, getInfo returns empty object
    mockGep.setRequiredFeatures.mockResolvedValue(undefined);
    mockGep.getInfo.mockResolvedValue({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();

    // Register an info listener so the adapter has callbacks to invoke
    registerInfoListener(provider);

    // Act: simulate game-detected
    triggerGameDetected(mockGep);

    // Wait for the async chain (setRequiredFeatures -> getInfo)
    await vi.waitFor(() => {
      expect(mockGep.getInfo).toHaveBeenCalledWith(APEX_GAME_ID);
    });
  });

  // ------------------------------------------------------------------
  // Test 2: getInfo() is NOT called if setRequiredFeatures fails
  // ------------------------------------------------------------------
  it('should NOT call getInfo() if setRequiredFeatures rejects', async () => {
    mockGep.setRequiredFeatures.mockRejectedValue(new Error('GEP not ready'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    registerInfoListener(provider);

    triggerGameDetected(mockGep);

    // Give time for any async work to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockGep.getInfo).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Test 3: Snapshot with legendSelect_0 at top level
  // ------------------------------------------------------------------
  it('should emit legendSelect_0 found at top level of snapshot', async () => {
    const legendData = JSON.stringify({
      playerName: 'TestPlayer',
      legendName: '#character_wraith_NAME',
      selectionOrder: '0',
      lead: true,
      is_local: true,
    });

    mockGep.getInfo.mockResolvedValue({
      legendSelect_0: legendData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(received.length).toBeGreaterThan(0);
    });

    // Find the legendSelect_0 emission
    const legendUpdate = received.find(
      (r) => r.info.key === 'legendSelect_0'
    );
    expect(legendUpdate).toBeDefined();
    expect(legendUpdate!.info.feature).toBe('team');
    expect(legendUpdate!.info.category).toBe('match_info');
    // Value should be parsed from JSON string
    const val = legendUpdate!.info.value as Record<string, unknown>;
    expect(val.playerName).toBe('TestPlayer');
    expect(val.legendName).toBe('#character_wraith_NAME');
  });

  // ------------------------------------------------------------------
  // Test 4: Snapshot with legendSelect_X nested inside categories
  // ------------------------------------------------------------------
  it('should find legendSelect_X at any nesting depth', async () => {
    const legendData = {
      playerName: 'NestedPlayer',
      legendName: '#character_bloodhound_NAME',
      selectionOrder: '1',
      lead: false,
      is_local: 'true',
    };

    mockGep.getInfo.mockResolvedValue({
      match_info: {
        legendSelect_1: JSON.stringify(legendData),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(received.length).toBeGreaterThan(0);
    });

    const legendUpdate = received.find(
      (r) => r.info.key === 'legendSelect_1'
    );
    expect(legendUpdate).toBeDefined();
    const val = legendUpdate!.info.value as Record<string, unknown>;
    expect(val.playerName).toBe('NestedPlayer');
  });

  // ------------------------------------------------------------------
  // Test 5: Multiple legendSelect keys are all emitted
  // ------------------------------------------------------------------
  it('should emit all legendSelect_X keys found in snapshot', async () => {
    mockGep.getInfo.mockResolvedValue({
      team: {
        match_info: {
          legendSelect_0: JSON.stringify({ playerName: 'P0', legendName: '#character_wraith_NAME', is_local: true }),
          legendSelect_1: JSON.stringify({ playerName: 'P1', legendName: '#character_lifeline_NAME', is_local: false }),
          legendSelect_2: JSON.stringify({ playerName: 'P2', legendName: '#character_octane_NAME', is_local: false }),
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(received.length).toBeGreaterThanOrEqual(3);
    });

    const legendKeys = received
      .filter((r) => typeof r.info.key === 'string' && (r.info.key as string).startsWith('legendSelect_'))
      .map((r) => r.info.key);
    expect(legendKeys).toContain('legendSelect_0');
    expect(legendKeys).toContain('legendSelect_1');
    expect(legendKeys).toContain('legendSelect_2');
  });

  // ------------------------------------------------------------------
  // Test 6: Null snapshot is handled gracefully
  // ------------------------------------------------------------------
  it('should handle null snapshot gracefully', async () => {
    mockGep.getInfo.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await new Promise((r) => setTimeout(r, 50));

    // No crash, no emissions from snapshot (only from real events)
    expect(received.length).toBe(0);
  });

  // ------------------------------------------------------------------
  // Test 7: Empty object snapshot is handled gracefully
  // ------------------------------------------------------------------
  it('should handle empty object snapshot gracefully', async () => {
    mockGep.getInfo.mockResolvedValue({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBe(0);
  });

  // ------------------------------------------------------------------
  // Test 8: getInfo() rejection is handled gracefully
  // ------------------------------------------------------------------
  it('should handle getInfo() rejection gracefully', async () => {
    mockGep.setRequiredFeatures.mockResolvedValue(undefined);
    mockGep.getInfo.mockRejectedValue(new Error('getInfo not available'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    // Should not throw
    triggerGameDetected(mockGep);

    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBe(0);
  });

  // ------------------------------------------------------------------
  // Test 9: legendSelect with value already parsed (not string)
  // ------------------------------------------------------------------
  it('should handle legendSelect_X where value is already an object (not JSON string)', async () => {
    const legendObj = {
      playerName: 'DirectObj',
      legendName: '#character_horizon_NAME',
      selectionOrder: '0',
      lead: false,
      is_local: '1',
    };

    mockGep.getInfo.mockResolvedValue({
      legendSelect_0: legendObj, // Already an object, not a JSON string
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(received.length).toBeGreaterThan(0);
    });

    const legendUpdate = received.find((r) => r.info.key === 'legendSelect_0');
    expect(legendUpdate).toBeDefined();
    const val = legendUpdate!.info.value as Record<string, unknown>;
    expect(val.playerName).toBe('DirectObj');
  });

  // ------------------------------------------------------------------
  // Test 10: Non-Apex game ID does not trigger getInfo()
  // ------------------------------------------------------------------
  it('should NOT call getInfo() for non-Apex game IDs', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    registerInfoListener(provider);

    // Trigger with a different game ID
    triggerGameDetected(mockGep, 99999);

    await new Promise((r) => setTimeout(r, 50));

    expect(mockGep.getInfo).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Test 11: Snapshot with non-legendSelect keys are ignored
  // ------------------------------------------------------------------
  it('should NOT emit non-legendSelect keys from snapshot', async () => {
    mockGep.getInfo.mockResolvedValue({
      tabs: '{"kills":3,"damage":500}',
      phase: 'landed',
      match_state: 'active',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await new Promise((r) => setTimeout(r, 50));

    // Should not have emitted anything -- no legendSelect keys
    expect(received.length).toBe(0);
  });

  // ------------------------------------------------------------------
  // Test 12: getInfo() with deeply nested structure (3+ levels)
  // ------------------------------------------------------------------
  it('should find legendSelect_X at 3+ nesting levels', async () => {
    mockGep.getInfo.mockResolvedValue({
      features: {
        team: {
          info: {
            match_info: {
              legendSelect_0: JSON.stringify({
                playerName: 'DeepPlayer',
                legendName: '#character_caustic_NAME',
                is_local: true,
              }),
            },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();
    const received = registerInfoListener(provider);

    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(received.length).toBeGreaterThan(0);
    });

    const legendUpdate = received.find((r) => r.info.key === 'legendSelect_0');
    expect(legendUpdate).toBeDefined();
    const val = legendUpdate!.info.value as Record<string, unknown>;
    expect(val.playerName).toBe('DeepPlayer');
  });
});
