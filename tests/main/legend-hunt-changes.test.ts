// ============================================================
// Legend Hunt Changes Tests
//
// Tests for three legend detection improvements:
// 1. setRequiredFeatures(null) first, fallback to explicit list
// 2. getInfo() exposed on GEPProvider + raw-phase event emission
// 3. Mozambique API fallback (tested separately in mozambique-legend-lookup.test.ts)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APEX_GAME_ID, GEP_REQUIRED_FEATURES } from '../../src/shared/constants';

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
    getInfo: vi.fn().mockResolvedValue({}),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function triggerGameDetected(mockGep: MockGepPackage, gameId: number = APEX_GAME_ID): void {
  const gameDetectedCalls = mockGep.on.mock.calls.filter(
    (c: unknown[]) => c[0] === 'game-detected'
  );
  for (const call of gameDetectedCalls) {
    const handler = call[1] as (e: { enable(): void }, gameId: number, name: string, info: unknown) => void;
    handler({ enable: vi.fn() }, gameId, 'Apex Legends', {});
  }
}

import { OwElectronGEPAdapter } from '../../src/main/gep/ow-electron-adapter';

// ---------------------------------------------------------------
// Change 1: setRequiredFeatures(null) first, then explicit list
// ---------------------------------------------------------------

describe('setRequiredFeatures null-first strategy', () => {
  let mockGep: MockGepPackage;

  beforeEach(() => {
    mockGep = createMockGep();
  });

  it('should try setRequiredFeatures(null) first on game-detected', async () => {
    // Arrange: null succeeds
    mockGep.setRequiredFeatures.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OwElectronGEPAdapter(mockGep as any);

    // Act: trigger game-detected
    triggerGameDetected(mockGep);

    // Assert: first call should be with null
    await vi.waitFor(() => {
      expect(mockGep.setRequiredFeatures).toHaveBeenCalledWith(APEX_GAME_ID, null);
    });
  });

  it('should NOT call explicit features when null succeeds', async () => {
    // Arrange: null succeeds
    mockGep.setRequiredFeatures.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OwElectronGEPAdapter(mockGep as any);

    triggerGameDetected(mockGep);

    // Wait for async chain to complete
    await vi.waitFor(() => {
      expect(mockGep.getInfo).toHaveBeenCalled();
    });

    // Should have been called only with null (and possibly once more from GEPManager retry)
    const calls = mockGep.setRequiredFeatures.mock.calls;
    // The FIRST call is null. If null succeeds, no explicit list call from game-detected handler.
    expect(calls[0]).toEqual([APEX_GAME_ID, null]);
    // There should NOT be a second call with explicit features from the adapter's game-detected handler
    const explicitCalls = calls.filter(
      (c: unknown[]) => Array.isArray(c[1]) && c[1].length === GEP_REQUIRED_FEATURES.length
    );
    expect(explicitCalls.length).toBe(0);
  });

  it('should fall back to explicit feature list when null fails', async () => {
    // Arrange: null rejects, explicit succeeds
    mockGep.setRequiredFeatures
      .mockRejectedValueOnce(new Error('null not supported'))
      .mockResolvedValueOnce(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OwElectronGEPAdapter(mockGep as any);

    triggerGameDetected(mockGep);

    // Wait for fallback chain
    await vi.waitFor(() => {
      expect(mockGep.setRequiredFeatures).toHaveBeenCalledTimes(2);
    });

    // First call: null
    expect(mockGep.setRequiredFeatures.mock.calls[0]).toEqual([APEX_GAME_ID, null]);
    // Second call: explicit features
    expect(mockGep.setRequiredFeatures.mock.calls[1]).toEqual([APEX_GAME_ID, GEP_REQUIRED_FEATURES]);
  });

  it('should call getInfo() after explicit fallback succeeds', async () => {
    // Arrange: null rejects, explicit succeeds
    mockGep.setRequiredFeatures
      .mockRejectedValueOnce(new Error('null not supported'))
      .mockResolvedValueOnce(undefined);
    mockGep.getInfo.mockResolvedValue({ phase: 'lobby' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OwElectronGEPAdapter(mockGep as any);

    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(mockGep.getInfo).toHaveBeenCalledWith(APEX_GAME_ID);
    });
  });

  it('should handle both null and explicit failing gracefully', async () => {
    // Arrange: both fail
    mockGep.setRequiredFeatures
      .mockRejectedValueOnce(new Error('null not supported'))
      .mockRejectedValueOnce(new Error('features not ready'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new OwElectronGEPAdapter(mockGep as any);

    // Act: should not throw
    triggerGameDetected(mockGep);

    await vi.waitFor(() => {
      expect(mockGep.setRequiredFeatures).toHaveBeenCalledTimes(2);
    });

    // getInfo should NOT be called since both registrations failed
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGep.getInfo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------
// Change 2: getInfo() exposed on GEPProvider + raw-phase event
// ---------------------------------------------------------------

describe('GEPProvider getInfo() exposure', () => {
  let mockGep: MockGepPackage;

  beforeEach(() => {
    mockGep = createMockGep();
  });

  it('should expose getInfo() on the provider', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();

    expect(provider.getInfo).toBeDefined();
    expect(typeof provider.getInfo).toBe('function');
  });

  it('should return snapshot from getInfo()', async () => {
    const expectedSnapshot = { phase: 'landed', tabs: { kills: 3 } };
    mockGep.getInfo.mockResolvedValue(expectedSnapshot);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();

    const snapshot = await provider.getInfo!();

    expect(snapshot).toEqual(expectedSnapshot);
    expect(mockGep.getInfo).toHaveBeenCalledWith(APEX_GAME_ID);
  });

  it('should return null when getInfo() fails', async () => {
    mockGep.getInfo.mockRejectedValue(new Error('not available'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(mockGep as any);
    const provider = adapter.asProvider();

    const snapshot = await provider.getInfo!();

    expect(snapshot).toBeNull();
  });
});

describe('EventProcessor raw-phase event', () => {
  it('should emit raw-phase with the unmodified phase string', async () => {
    const { EventProcessor } = await import('../../src/main/gep/event-processor');
    const processor = new EventProcessor();

    const rawPhases: string[] = [];
    processor.on('raw-phase', (phase: string) => {
      rawPhases.push(phase);
    });

    // Simulate a loading_screen phase info update (ow-electron key-value format)
    processor.processInfoUpdate({
      info: {
        key: 'phase',
        value: 'loading_screen',
        feature: 'game_info',
        category: 'game_info',
      },
    });

    expect(rawPhases).toContain('loading_screen');
  });

  it('should emit raw-phase for all phase values', async () => {
    const { EventProcessor } = await import('../../src/main/gep/event-processor');
    const processor = new EventProcessor();

    const rawPhases: string[] = [];
    processor.on('raw-phase', (phase: string) => {
      rawPhases.push(phase);
    });

    const phases = ['lobby', 'loading_screen', 'legend_selection', 'aircraft', 'freefly', 'landed', 'match_summary'];
    for (const phase of phases) {
      processor.processInfoUpdate({
        info: { key: 'phase', value: phase, feature: 'game_info', category: 'game_info' },
      });
    }

    expect(rawPhases).toEqual(phases);
  });

  it('should emit raw-phase in lowercase', async () => {
    const { EventProcessor } = await import('../../src/main/gep/event-processor');
    const processor = new EventProcessor();

    const rawPhases: string[] = [];
    processor.on('raw-phase', (phase: string) => {
      rawPhases.push(phase);
    });

    processor.processInfoUpdate({
      info: { key: 'phase', value: 'Loading_Screen', feature: 'game_info', category: 'game_info' },
    });

    // The raw phase emission uses newPhase which is value.toLowerCase()
    expect(rawPhases).toContain('loading_screen');
  });
});

// ---------------------------------------------------------------
// Change 2: GEPManager getInfo() delegation
// ---------------------------------------------------------------

describe('GEPManager getInfo()', () => {
  it('should delegate to provider getInfo() when available', async () => {
    const { GEPManager } = await import('../../src/main/gep/gep-manager');
    const mockProvider = {
      setRequiredFeatures: vi.fn().mockResolvedValue({ success: true, supportedFeatures: [] }),
      getInfo: vi.fn().mockResolvedValue({ phase: 'lobby' }),
      onNewEvents: { addListener: vi.fn(), removeListener: vi.fn() },
      onInfoUpdates2: { addListener: vi.fn(), removeListener: vi.fn() },
    };

    const manager = new GEPManager(mockProvider);
    const result = await manager.getInfo();

    expect(result).toEqual({ phase: 'lobby' });
    expect(mockProvider.getInfo).toHaveBeenCalled();
  });

  it('should return null when provider has no getInfo()', async () => {
    const { GEPManager } = await import('../../src/main/gep/gep-manager');
    const mockProvider = {
      setRequiredFeatures: vi.fn().mockResolvedValue({ success: true, supportedFeatures: [] }),
      // No getInfo property
      onNewEvents: { addListener: vi.fn(), removeListener: vi.fn() },
      onInfoUpdates2: { addListener: vi.fn(), removeListener: vi.fn() },
    };

    const manager = new GEPManager(mockProvider);
    const result = await manager.getInfo();

    expect(result).toBeNull();
  });
});
