// ============================================================
// Tabs Auto-Start Cooldown Tests
//
// Bug: After MATCH_END, stale tabs data (with kills > 0) can
// arrive from GEP. The tabs auto-start logic triggers a
// spurious MATCH_START which:
//   1. Resets currentMatch stats to zeros
//   2. Broadcasts MATCH_START to PostMatch window
//   3. PostMatch window calls resetMatch() -> all stats zeroed
//
// The coaching engine already saved correct data to DB before
// this reset, which is why coaching shows "2 kills" but the
// display shows "Kills: 0".
//
// Fix: Add a cooldown window after MATCH_END during which
// tabs auto-start is suppressed. Stale tabs data is expected
// to arrive within a few seconds of match end.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventProcessor } from '../../src/main/gep/event-processor';
import type { DomainEvent } from '../../src/shared/types';

describe('Tabs auto-start cooldown after MATCH_END', () => {
  let processor: EventProcessor;
  let emittedEvents: DomainEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    processor = new EventProcessor();
    emittedEvents = [];
    processor.on('domain-event', (event: DomainEvent) => {
      emittedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    processor.removeAllListeners();
  });

  it('should NOT auto-start a new match from stale tabs arriving right after MATCH_END', () => {
    // Play a normal match
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'A', weapon: 'R-301', headshot: false }));

    // Tabs update during match (normal)
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 2, assists: 1, damage: 800, teams: 5, players: 12 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // End the match
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'match_summary', feature: 'game_info', category: 'game_info' },
    });

    // Clear for counting
    const matchStartsBeforeStale = emittedEvents.filter((e) => e.type === 'MATCH_START').length;
    emittedEvents.length = 0;

    // Stale tabs data arrives 2 seconds after match end (GEP async)
    vi.advanceTimersByTime(2000);
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 2, assists: 1, damage: 800, teams: 5, players: 12 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // Should NOT have auto-started a new match from stale tabs
    const spuriousStarts = emittedEvents.filter((e) => e.type === 'MATCH_START');
    expect(spuriousStarts.length).toBe(0);
  });

  it('should still allow tabs auto-start after cooldown expires', () => {
    // Play and end a match
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'match_summary', feature: 'game_info', category: 'game_info' },
    });

    emittedEvents.length = 0;

    // Wait for cooldown to expire (should be at least 10 seconds)
    vi.advanceTimersByTime(15000);

    // Now tabs data for a genuinely new match should auto-start
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 1, assists: 0, damage: 200, teams: 15, players: 45 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    const starts = emittedEvents.filter((e) => e.type === 'MATCH_START');
    expect(starts.length).toBe(1);
  });

  it('should preserve match stats when stale tabs arrive after match end', () => {
    // Play a match with kills from tabs
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });
    processor.processRawEvent('death', JSON.stringify({ attackerName: 'X', weapon: 'Kraber' }));
    processor.processRawEvent('death', JSON.stringify({ attackerName: 'Y', weapon: 'R-99' }));

    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 3, assists: 2, damage: 1500, teams: 5, players: 12 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // End match -- currentMatch should have kills=3, deaths=2
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'match_summary', feature: 'game_info', category: 'game_info' },
    });

    // Match stats at this point should reflect the match data
    const matchAfterEnd = processor.getCurrentMatchStats();
    expect(matchAfterEnd.kills).toBe(3);
    expect(matchAfterEnd.deaths).toBe(2);
    expect(matchAfterEnd.damage).toBe(1500);

    // Stale tabs arrive
    vi.advanceTimersByTime(1000);
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 3, assists: 2, damage: 1500, teams: 5, players: 12 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // Match stats should STILL reflect the original match data
    // (no spurious reset from auto-start)
    const matchAfterStale = processor.getCurrentMatchStats();
    expect(matchAfterStale.kills).toBe(3);
    expect(matchAfterStale.deaths).toBe(2);
    expect(matchAfterStale.damage).toBe(1500);
  });

  it('should NOT reset PostMatch-visible match stats by spurious MATCH_START', () => {
    // This is the key bug scenario:
    // 1. Match ends with kills=2, deaths=5
    // 2. Stale tabs with kills=2 arrives
    // 3. Auto-start fires -> resets currentMatch to zeros
    // 4. PostMatch window resets its store
    //
    // After the fix, step 3 should NOT happen during cooldown.

    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    // 5 deaths
    for (let i = 0; i < 5; i++) {
      processor.processRawEvent('death', JSON.stringify({ attackerName: `Enemy${i}`, weapon: 'R-301' }));
    }

    // Tabs shows 2 kills, 440 damage
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 2, assists: 0, damage: 440, teams: 5, players: 12, knockdowns: 3 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // Match ends
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'match_summary', feature: 'game_info', category: 'game_info' },
    });

    // Verify match stats are correct BEFORE stale tabs
    const statsBeforeStale = processor.getCurrentMatchStats();
    expect(statsBeforeStale.kills).toBe(2);
    expect(statsBeforeStale.deaths).toBe(5);
    expect(statsBeforeStale.damage).toBe(440);

    // Count MATCH_START events so far
    const startsBeforeStale = emittedEvents.filter((e) => e.type === 'MATCH_START').length;

    // Stale tabs arrive 1s later
    vi.advanceTimersByTime(1000);
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 2, assists: 0, damage: 440, teams: 5, players: 12, knockdowns: 3 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // No new MATCH_START should have fired
    const startsAfterStale = emittedEvents.filter((e) => e.type === 'MATCH_START').length;
    expect(startsAfterStale).toBe(startsBeforeStale);

    // Match stats should be unchanged
    const statsAfterStale = processor.getCurrentMatchStats();
    expect(statsAfterStale.kills).toBe(2);
    expect(statsAfterStale.deaths).toBe(5);
    expect(statsAfterStale.damage).toBe(440);
  });
});
