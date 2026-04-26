/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { installMockBridge } from '../test-utils';
import { useCoachingInsights } from '../../../src/renderer/hooks/useCoachingInsights';

describe('useCoachingInsights', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = installMockBridge();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('initially has no insights', () => {
    const { result } = renderHook(() => useCoachingInsights());
    expect(result.current.latestInsight).toBeNull();
    expect(result.current.matchInsights).toEqual([]);
  });

  it('subscribes to coaching:insight IPC channel', () => {
    renderHook(() => useCoachingInsights());
    expect(bridge.mock.on).toHaveBeenCalledWith(
      'coaching:insight',
      expect.any(Function)
    );
  });

  it('updates latestInsight when coaching:insight arrives', () => {
    const { result } = renderHook(() => useCoachingInsights());

    const insight = {
      id: 1,
      matchId: 1,
      sessionId: 1,
      type: 'session_vs_average',
      ruleId: 'test',
      message: 'Your KD improved!',
      severity: 'achievement',
      dataJson: null,
      dismissed: false,
      createdAt: '2025-01-01T00:00:00Z',
    };

    act(() => {
      bridge.emit('coaching:insight', insight);
    });

    expect(result.current.latestInsight).toEqual(insight);
    expect(result.current.matchInsights).toHaveLength(1);
  });

  it('accumulates multiple insights', () => {
    const { result } = renderHook(() => useCoachingInsights());

    act(() => {
      bridge.emit('coaching:insight', {
        id: 1, message: 'Insight 1', severity: 'info',
        matchId: null, sessionId: null, type: 'session_vs_average',
        ruleId: 'r1', dataJson: null, dismissed: false, createdAt: '',
      });
      bridge.emit('coaching:insight', {
        id: 2, message: 'Insight 2', severity: 'warning',
        matchId: null, sessionId: null, type: 'trend_declining',
        ruleId: 'r2', dataJson: null, dismissed: false, createdAt: '',
      });
    });

    expect(result.current.matchInsights).toHaveLength(2);
    // Latest is most recent
    expect(result.current.latestInsight?.id).toBe(2);
  });

  it('clears insights on match:start', () => {
    const { result } = renderHook(() => useCoachingInsights());

    act(() => {
      bridge.emit('coaching:insight', {
        id: 1, message: 'Insight 1', severity: 'info',
        matchId: null, sessionId: null, type: 'session_vs_average',
        ruleId: 'r1', dataJson: null, dismissed: false, createdAt: '',
      });
    });

    expect(result.current.matchInsights).toHaveLength(1);

    act(() => {
      bridge.emit('match:start');
    });

    expect(result.current.matchInsights).toEqual([]);
    expect(result.current.latestInsight).toBeNull();
  });

  it('auto-dismisses latest insight after 5 seconds', () => {
    const { result } = renderHook(() => useCoachingInsights());

    act(() => {
      bridge.emit('coaching:insight', {
        id: 1, message: 'Temporary', severity: 'info',
        matchId: null, sessionId: null, type: 'session_vs_average',
        ruleId: 'r1', dataJson: null, dismissed: false, createdAt: '',
      });
    });

    expect(result.current.latestInsight).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.latestInsight).toBeNull();
  });
});
