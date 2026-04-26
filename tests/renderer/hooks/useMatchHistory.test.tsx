/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { installMockBridge } from '../test-utils';
import { useMatchHistory } from '../../../src/renderer/hooks/useMatchHistory';

const MOCK_MATCHES = [
  {
    id: 1,
    matchId: 'abc-123',
    sessionId: 1,
    legend: 'Horizon',
    map: 'Storm Point',
    mode: 'ranked',
    placement: 2,
    kills: 5,
    deaths: 1,
    assists: 3,
    damage: 1800,
    headshots: 2,
    shotsFired: 100,
    shotsHit: 40,
    knockdowns: 6,
    revives: 1,
    respawns: 0,
    survivalTime: 900,
    rpChange: 120,
    duration: 1100,
    startedAt: '2025-01-01T10:00:00Z',
    endedAt: '2025-01-01T10:18:00Z',
  },
  {
    id: 2,
    matchId: 'def-456',
    sessionId: 1,
    legend: 'Wraith',
    map: 'World\'s Edge',
    mode: 'battle_royale',
    placement: 5,
    kills: 3,
    deaths: 1,
    assists: 1,
    damage: 900,
    headshots: 1,
    shotsFired: 80,
    shotsHit: 30,
    knockdowns: 3,
    revives: 0,
    respawns: 0,
    survivalTime: 600,
    rpChange: null,
    duration: 700,
    startedAt: '2025-01-01T09:00:00Z',
    endedAt: '2025-01-01T09:12:00Z',
  },
];

describe('useMatchHistory', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    bridge.mock.invoke.mockResolvedValue(MOCK_MATCHES);
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('fetches match history on mount via IPC invoke', async () => {
    const { result } = renderHook(() => useMatchHistory());

    await waitFor(() => {
      expect(result.current.matches).toHaveLength(2);
    });

    expect(bridge.mock.invoke).toHaveBeenCalledWith('match:history');
  });

  it('returns loading state initially', () => {
    bridge.mock.invoke.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useMatchHistory());
    expect(result.current.loading).toBe(true);
    expect(result.current.matches).toEqual([]);
  });

  it('returns matches after loading', async () => {
    const { result } = renderHook(() => useMatchHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.matches).toEqual(MOCK_MATCHES);
  });

  it('provides a refresh function', async () => {
    const { result } = renderHook(() => useMatchHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear mock and set new data
    bridge.mock.invoke.mockResolvedValue([MOCK_MATCHES[0]]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.matches).toHaveLength(1);
  });

  it('refreshes when match:end event arrives', async () => {
    const { result } = renderHook(() => useMatchHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    bridge.mock.invoke.mockResolvedValue([MOCK_MATCHES[0]]);

    act(() => {
      bridge.emit('match:end');
    });

    await waitFor(() => {
      expect(result.current.matches).toHaveLength(1);
    });
  });
});
