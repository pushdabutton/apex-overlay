/**
 * @vitest-environment jsdom
 */
// ============================================================
// PostMatch IPC Wiring Tests
// Verifies that the PostMatch window subscribes to SESSION_UPDATE
// IPC channel so session stores are populated in the post-match
// window (which is a separate BrowserWindow with its own stores).
//
// Bug: PostMatch.tsx only subscribed to MATCH_END, MATCH_UPDATE,
// COACHING_INSIGHT, MATCH_START -- but NOT SESSION_UPDATE.
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { installMockBridge } from '../test-utils';
import { PostMatch } from '../../../src/renderer/windows/PostMatch/PostMatch';
import { useMatchStore } from '../../../src/renderer/stores/match-store';
import { useSessionStore } from '../../../src/renderer/stores/session-store';
import { IPC } from '../../../src/shared/ipc-channels';

describe('PostMatch IPC wiring', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    useMatchStore.getState().resetMatch();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('should subscribe to SESSION_UPDATE channel', () => {
    render(<PostMatch />);

    // Check that the mock bridge was called with SESSION_UPDATE
    const sessionUpdateCalls = bridge.mock.on.mock.calls.filter(
      (call: unknown[]) => call[0] === IPC.SESSION_UPDATE
    );
    expect(sessionUpdateCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should update session store when SESSION_UPDATE arrives via IPC', () => {
    render(<PostMatch />);

    // Simulate SESSION_UPDATE arriving from main process
    act(() => {
      bridge.emit(IPC.SESSION_UPDATE, {
        totalKills: 15,
        totalDeaths: 5,
        totalDamage: 4500,
        totalAssists: 7,
        totalHeadshots: 3,
        totalKnockdowns: 8,
        matchesPlayed: 3,
      });
    });

    // Session store should be populated
    const session = useSessionStore.getState();
    expect(session.totalKills).toBe(15);
    expect(session.totalDeaths).toBe(5);
    expect(session.totalDamage).toBe(4500);
    expect(session.matchesPlayed).toBe(3);
  });

  it('should unsubscribe SESSION_UPDATE on unmount', () => {
    const { unmount } = render(<PostMatch />);

    // Get the unsubscribe function that was returned
    const sessionUpdateCalls = bridge.mock.on.mock.calls.filter(
      (call: unknown[]) => call[0] === IPC.SESSION_UPDATE
    );
    expect(sessionUpdateCalls.length).toBeGreaterThanOrEqual(1);

    // Unmount should clean up
    unmount();

    // Emit after unmount -- should NOT update store
    useSessionStore.getState().resetSession();
    act(() => {
      bridge.emit(IPC.SESSION_UPDATE, {
        totalKills: 99,
        totalDeaths: 99,
        matchesPlayed: 99,
      });
    });

    // Store should still be zero (unsubscribed)
    const session = useSessionStore.getState();
    expect(session.totalKills).toBe(0);
  });
});
