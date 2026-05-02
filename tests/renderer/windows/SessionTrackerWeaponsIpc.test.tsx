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
      rankScore: 5000,
    });

    bridge.emit(IPC.WEAPONS_UPDATE, {
      weapon0: 'Wingman',
    });

    const state = useMatchStore.getState();
    expect(state.rankName).toBe('Gold II');
    expect(state.rankScore).toBe(5000);
    expect(state.weapons).toEqual({ weapon0: 'Wingman' });
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
