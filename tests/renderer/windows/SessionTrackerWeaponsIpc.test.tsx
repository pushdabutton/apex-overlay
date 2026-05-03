/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { installMockBridge } from '../test-utils';
import { SessionTracker } from '../../../src/renderer/windows/MainOverlay/SessionTracker';
import { useMatchStore } from '../../../src/renderer/stores/match-store';
import { useSessionStore } from '../../../src/renderer/stores/session-store';
import { IPC } from '../../../src/shared/ipc-channels';

describe('SessionTracker weapons IPC wiring', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    useMatchStore.getState().resetMatch();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('subscribes to WEAPONS_UPDATE IPC channel', () => {
    render(<SessionTracker />);

    // Verify that on() was called with the weapons channel
    const onCalls = bridge.mock.on.mock.calls;
    const weaponsSubscription = onCalls.find(
      (call: unknown[]) => call[0] === IPC.WEAPONS_UPDATE,
    );
    expect(weaponsSubscription).toBeDefined();
  });

  it('updates match store weapons when WEAPONS_UPDATE fires', () => {
    render(<SessionTracker />);

    // Simulate weapons update from main process
    bridge.emit(IPC.WEAPONS_UPDATE, {
      weapon0: 'R-301 Carbine',
      weapon1: 'EVA-8 Auto',
    });

    const state = useMatchStore.getState();
    expect(state.weapons).toEqual({
      weapon0: 'R-301 Carbine',
      weapon1: 'EVA-8 Auto',
    });
  });

  it('continues to handle MATCH_UPDATE alongside WEAPONS_UPDATE', () => {
    render(<SessionTracker />);

    // Both channels should work independently
    bridge.emit(IPC.MATCH_UPDATE, {
      type: 'rank',
      rankName: 'Gold II',
      rankScore: 7339,
    });

    bridge.emit(IPC.WEAPONS_UPDATE, {
      weapon0: 'Wingman',
    });

    const state = useMatchStore.getState();
    expect(state.rankName).toBe('Gold II');
    expect(state.rankScore).toBe(7339);
    expect(state.weapons).toEqual({ weapon0: 'Wingman' });
  });

  it('formats rank name with division when API_PLAYER_PROFILE fires', () => {
    render(<SessionTracker />);

    // Simulate API profile arriving with tier-only rankName and rankDivision
    // The mozambiquehe.re API returns rankName: "Gold" and rankDiv: 2
    bridge.emit(IPC.API_PLAYER_PROFILE, {
      rankName: 'Gold',
      rankScore: 7339,
      rankDivision: 2,
      platform: 'PC',
      playerName: 'TestPlayer',
      uid: '123',
      level: 500,
    });

    const state = useMatchStore.getState();
    // Should be formatted as "Gold II", not just "Gold"
    expect(state.rankName).toBe('Gold II');
    expect(state.rankScore).toBe(7339);
  });

  it('handles Master rank (no division) from API_PLAYER_PROFILE', () => {
    render(<SessionTracker />);

    bridge.emit(IPC.API_PLAYER_PROFILE, {
      rankName: 'Master',
      rankScore: 18000,
      rankDivision: 0,
      platform: 'PC',
      playerName: 'TestPlayer',
      uid: '123',
      level: 500,
    });

    const state = useMatchStore.getState();
    expect(state.rankName).toBe('Master');
    expect(state.rankScore).toBe(18000);
  });

  it('handles missing rankDivision in API_PLAYER_PROFILE gracefully', () => {
    render(<SessionTracker />);

    // Some edge case where rankDivision is not provided
    bridge.emit(IPC.API_PLAYER_PROFILE, {
      rankName: 'Platinum',
      rankScore: 9000,
      platform: 'PC',
      playerName: 'TestPlayer',
      uid: '123',
      level: 500,
    });

    const state = useMatchStore.getState();
    // Without division, should default to tier-only
    expect(state.rankName).toBe('Platinum');
    expect(state.rankScore).toBe(9000);
  });

  it('cleans up weapons subscription on unmount', () => {
    const { unmount } = render(<SessionTracker />);

    // Before unmount, weapons IPC should work
    bridge.emit(IPC.WEAPONS_UPDATE, { weapon0: 'Flatline' });
    expect(useMatchStore.getState().weapons).toEqual({ weapon0: 'Flatline' });

    // Unmount and reset store
    unmount();
    useMatchStore.getState().resetMatch();

    // After unmount, emitting should NOT update (listener removed)
    bridge.emit(IPC.WEAPONS_UPDATE, { weapon0: 'Devotion' });
    expect(useMatchStore.getState().weapons).toEqual({});
  });
});
