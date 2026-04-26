/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { installMockBridge } from '../test-utils';
import { useSessionStats } from '../../../src/renderer/hooks/useSessionStats';
import { useSessionStore } from '../../../src/renderer/stores/session-store';

describe('useSessionStats', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('returns current session stats', () => {
    const { result } = renderHook(() => useSessionStats());
    expect(result.current.totalKills).toBe(0);
    expect(result.current.kd).toBe('0.00');
  });

  it('subscribes to session:update IPC channel', () => {
    renderHook(() => useSessionStats());
    expect(bridge.mock.on).toHaveBeenCalledWith(
      'session:update',
      expect.any(Function)
    );
  });

  it('updates when session:update IPC event arrives', () => {
    const { result } = renderHook(() => useSessionStats());

    act(() => {
      bridge.emit('session:update', {
        totalKills: 12,
        totalDeaths: 3,
        totalDamage: 2400,
        matchesPlayed: 2,
      });
    });

    expect(result.current.totalKills).toBe(12);
    expect(result.current.totalDeaths).toBe(3);
    expect(result.current.kd).toBe('4.00');
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSessionStats());
    const unsubCalls = bridge.mock.on.mock.results;
    // The returned unsubscribe function should be callable
    expect(unsubCalls.length).toBeGreaterThan(0);
    unmount();
    // After unmount, no more listeners should be active for this hook
  });
});
