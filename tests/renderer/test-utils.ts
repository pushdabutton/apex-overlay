/**
 * Shared test utilities for renderer tests.
 * Provides mock for window.apexCoach (the preload bridge).
 */
import { vi } from 'vitest';

type Listener = (...args: unknown[]) => void;

/**
 * Creates a mock window.apexCoach bridge for testing hooks and components
 * that rely on IPC communication.
 */
export function createMockApexCoach() {
  const listeners = new Map<string, Set<Listener>>();

  const mock = {
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((channel: string, callback: Listener) => {
      if (!listeners.has(channel)) {
        listeners.set(channel, new Set());
      }
      listeners.get(channel)!.add(callback);
      return () => {
        listeners.get(channel)?.delete(callback);
      };
    }),
    once: vi.fn(),
    channels: {
      MATCH_UPDATE: 'match:update',
      MATCH_START: 'match:start',
      MATCH_END: 'match:end',
      SESSION_UPDATE: 'session:update',
      COACHING_INSIGHT: 'coaching:insight',
      API_MAP_ROTATION: 'api:map-rotation',
      API_CRAFTING: 'api:crafting',
      API_PLAYER_PROFILE: 'api:player-profile',
      GAME_PHASE: 'game:phase',
      SETTINGS_GET: 'settings:get',
      SETTINGS_SET: 'settings:set',
      SETTINGS_GET_ALL: 'settings:get-all',
      SESSION_HISTORY: 'session:history',
      MATCH_HISTORY: 'match:history',
      LEGEND_STATS: 'legend:stats',
      INSIGHTS_HISTORY: 'insights:history',
    },
  };

  /** Simulate main process emitting an event to renderer */
  function emit(channel: string, ...args: unknown[]) {
    const channelListeners = listeners.get(channel);
    if (channelListeners) {
      channelListeners.forEach((cb) => cb(...args));
    }
  }

  return { mock, emit, listeners };
}

/**
 * Install mock apexCoach on window and return emit helper.
 */
export function installMockBridge() {
  const bridge = createMockApexCoach();
  (window as unknown as Record<string, unknown>).apexCoach = bridge.mock;
  return bridge;
}
