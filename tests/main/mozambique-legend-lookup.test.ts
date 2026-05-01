// ============================================================
// Mozambique API getSelectedLegend Tests
//
// Tests the mozambiquehe.re API fallback for legend detection.
// When GEP legendSelect_X events don't fire, we fall back to
// querying the external API for the player's currently selected
// legend via realtime.selectedLegend.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test MozambiqueClient's getSelectedLegend method in isolation
// by mocking fetch and providing a mock DB.

// Create a minimal mock database for MozambiqueClient constructor
function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ value: 'test-api-key-123' }),
      run: vi.fn(),
    }),
  };
}

function createMockDbNoKey() {
  return {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
    }),
  };
}

describe('MozambiqueClient.getSelectedLegend', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should return selectedLegend from realtime data', async () => {
    // Arrange: mock API returning selectedLegend in realtime
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        global: { name: 'TestPlayer', uid: 12345 },
        realtime: { selectedLegend: 'Lifeline', currentState: 'inMatch' },
      }),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    // Act
    const legend = await client.getSelectedLegend('TestPlayer');

    // Assert
    expect(legend).toBe('Lifeline');
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('player=TestPlayer');
    expect(calledUrl).toContain('platform=PC');
    expect(calledUrl).toContain('auth=test-api-key-123');
  });

  it('should return selectedLegend from global.legends.selected.LegendName', async () => {
    // Some API responses have the legend under global.legends.selected
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        global: {
          name: 'TestPlayer',
          uid: 12345,
          legends: {
            selected: { LegendName: 'Wraith', data: [] },
          },
        },
        realtime: { currentState: 'inMatch' },
      }),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    const legend = await client.getSelectedLegend('TestPlayer');

    // global.legends.selected.LegendName takes priority
    expect(legend).toBe('Wraith');
  });

  it('should return null when API key is not configured', async () => {
    globalThis.fetch = vi.fn();

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDbNoKey() as any);

    const legend = await client.getSelectedLegend('TestPlayer');

    expect(legend).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should return null when API returns non-OK status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    const legend = await client.getSelectedLegend('NonexistentPlayer');

    expect(legend).toBeNull();
  });

  it('should return null when API response has no selectedLegend field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        global: { name: 'TestPlayer', uid: 12345 },
        realtime: { currentState: 'offline' },
        // No selectedLegend field
      }),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    const legend = await client.getSelectedLegend('TestPlayer');

    expect(legend).toBeNull();
  });

  it('should return null when fetch throws (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    const legend = await client.getSelectedLegend('TestPlayer');

    expect(legend).toBeNull();
  });

  it('should use the platform parameter in the API URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        global: { name: 'ConsolePlayer' },
        realtime: { selectedLegend: 'Octane' },
      }),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    const legend = await client.getSelectedLegend('ConsolePlayer', 'PS4');

    expect(legend).toBe('Octane');
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('platform=PS4');
  });

  it('should default platform to PC when not specified', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        global: { name: 'PCPlayer' },
        realtime: { selectedLegend: 'Bangalore' },
      }),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    await client.getSelectedLegend('PCPlayer');

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('platform=PC');
  });

  it('should URL-encode the player name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        global: { name: 'Player With Spaces' },
        realtime: { selectedLegend: 'Caustic' },
      }),
    });

    const { MozambiqueClient } = await import('../../src/main/api/mozambique-client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new MozambiqueClient(createMockDb() as any);

    await client.getSelectedLegend('Player With Spaces');

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('player=Player%20With%20Spaces');
  });
});
