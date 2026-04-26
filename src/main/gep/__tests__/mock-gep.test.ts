// ============================================================
// Mock GEP -- RED Tests (TDD Phase 1)
// Tests for the development-time mock GEP provider
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockGEP } from '../mock-gep';
import type { GEPProvider } from '../gep-manager';

describe('MockGEP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should implement the GEPProvider interface', () => {
    const mock = new MockGEP();
    const provider: GEPProvider = mock.asProvider();

    // Verify it has the right shape
    expect(provider.setRequiredFeatures).toBeTypeOf('function');
    expect(provider.onNewEvents).toBeDefined();
    expect(provider.onNewEvents.addListener).toBeTypeOf('function');
    expect(provider.onNewEvents.removeListener).toBeTypeOf('function');
    expect(provider.onInfoUpdates2).toBeDefined();
    expect(provider.onInfoUpdates2.addListener).toBeTypeOf('function');
    expect(provider.onInfoUpdates2.removeListener).toBeTypeOf('function');
  });

  it('should simulate a full match sequence', async () => {
    const mock = new MockGEP();
    const provider = mock.asProvider();
    const events: Array<{ events: Array<{ name: string; data: string }> }> = [];

    provider.onNewEvents.addListener((payload: unknown) => {
      events.push(payload as { events: Array<{ name: string; data: string }> });
    });

    const simPromise = mock.simulateMatch();

    // Advance through all delays in the match simulation
    await vi.advanceTimersByTimeAsync(60_000);

    await simPromise;

    // Should fire events in order: match_start, then gameplay events, then match_end
    const eventNames = events.flatMap(e => e.events.map(ev => ev.name));
    expect(eventNames[0]).toBe('match_start');
    expect(eventNames[eventNames.length - 1]).toBe('match_end');
    expect(eventNames.length).toBeGreaterThanOrEqual(5);
  });

  it('should fire events in correct order', async () => {
    const mock = new MockGEP();
    const provider = mock.asProvider();
    const eventNames: string[] = [];

    provider.onNewEvents.addListener((payload: unknown) => {
      const p = payload as { events: Array<{ name: string; data: string }> };
      for (const e of p.events) {
        eventNames.push(e.name);
      }
    });

    const simPromise = mock.simulateMatch();
    await vi.advanceTimersByTimeAsync(60_000);
    await simPromise;

    // match_start must come before any gameplay events
    const matchStartIdx = eventNames.indexOf('match_start');
    const matchEndIdx = eventNames.indexOf('match_end');
    expect(matchStartIdx).toBe(0);
    expect(matchEndIdx).toBe(eventNames.length - 1);
    expect(matchEndIdx).toBeGreaterThan(matchStartIdx);
  });

  it('should include realistic damage data', async () => {
    const mock = new MockGEP();
    const provider = mock.asProvider();
    const damageEvents: Array<{ damageAmount: string; targetName: string }> = [];

    provider.onNewEvents.addListener((payload: unknown) => {
      const p = payload as { events: Array<{ name: string; data: string }> };
      for (const e of p.events) {
        if (e.name === 'damage') {
          damageEvents.push(JSON.parse(e.data));
        }
      }
    });

    const simPromise = mock.simulateMatch();
    await vi.advanceTimersByTimeAsync(60_000);
    await simPromise;

    expect(damageEvents.length).toBeGreaterThan(0);
    for (const dmg of damageEvents) {
      const amount = parseInt(dmg.damageAmount, 10);
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThanOrEqual(300); // realistic cap
      expect(dmg.targetName).toBeTruthy();
    }
  });

  it('should support custom event injection', () => {
    const mock = new MockGEP();
    const provider = mock.asProvider();
    const events: Array<{ events: Array<{ name: string; data: string }> }> = [];

    provider.onNewEvents.addListener((payload: unknown) => {
      events.push(payload as { events: Array<{ name: string; data: string }> });
    });

    mock.injectEvent('kill', { victimName: 'CustomVictim', weapon: 'Wingman', headshot: true });

    expect(events).toHaveLength(1);
    expect(events[0].events[0].name).toBe('kill');
    const data = JSON.parse(events[0].events[0].data);
    expect(data.victimName).toBe('CustomVictim');
    expect(data.weapon).toBe('Wingman');
  });

  it('should toggle between mock and real GEP via env variable', async () => {
    // The createGEPProvider factory should return MockGEP when USE_MOCK_GEP=true
    const { createGEPProvider } = await import('../gep-provider-factory');

    const original = process.env.USE_MOCK_GEP;
    try {
      process.env.USE_MOCK_GEP = 'true';
      const provider = createGEPProvider();
      // Mock provider always succeeds setRequiredFeatures
      const result = await provider.setRequiredFeatures(['kill', 'death']);
      expect(result.success).toBe(true);
    } finally {
      process.env.USE_MOCK_GEP = original;
    }
  });

  it('should register features successfully (mock always succeeds)', async () => {
    const mock = new MockGEP();
    const provider = mock.asProvider();
    const result = await provider.setRequiredFeatures(['kill', 'death', 'damage']);
    expect(result.success).toBe(true);
    expect(result.supportedFeatures).toEqual(['kill', 'death', 'damage']);
  });
});
