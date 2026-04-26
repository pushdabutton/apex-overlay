// ============================================================
// Event Processor -- RED Tests (TDD Phase 1)
// Tests for raw GEP event -> typed domain event conversion,
// session stat accumulation, and event batching
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventProcessor } from '../event-processor';
import type { DomainEvent } from '../../../shared/types';

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let emittedEvents: DomainEvent[];

  beforeEach(() => {
    processor = new EventProcessor();
    emittedEvents = [];
    processor.on('domain-event', (event: DomainEvent) => {
      emittedEvents.push(event);
    });
  });

  afterEach(() => {
    processor.removeAllListeners();
  });

  // -----------------------------------------------------------------------
  // Event Conversion
  // -----------------------------------------------------------------------

  it('should convert raw GEP kill event to typed KillEvent', () => {
    processor.processRawEvent('kill', JSON.stringify({
      victimName: 'Player99',
      weapon: 'R-301',
      headshot: true,
    }));

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0];
    expect(event.type).toBe('PLAYER_KILL');
    if (event.type === 'PLAYER_KILL') {
      expect(event.victim).toBe('Player99');
      expect(event.weapon).toBe('R-301');
      expect(event.headshot).toBe(true);
      expect(event.timestamp).toBeTypeOf('number');
    }
  });

  it('should convert raw GEP damage event to typed DamageEvent with headshot flag', () => {
    processor.processRawEvent('damage', JSON.stringify({
      damageAmount: '87',
      targetName: 'TargetPlayer',
      weapon: 'Peacekeeper',
      headshot: 'true',
    }));

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0];
    expect(event.type).toBe('DAMAGE_DEALT');
    if (event.type === 'DAMAGE_DEALT') {
      expect(event.amount).toBe(87);
      expect(event.target).toBe('TargetPlayer');
      expect(event.weapon).toBe('Peacekeeper');
    }
  });

  // -----------------------------------------------------------------------
  // Session Stats Accumulation
  // -----------------------------------------------------------------------

  it('should track cumulative session stats (kills, deaths, damage)', () => {
    // Start a match
    processor.processRawEvent('match_start', JSON.stringify({ mode: 'battle_royale' }));

    // Fire some events
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'A', weapon: 'R-301', headshot: false }));
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'B', weapon: 'R-301', headshot: true }));
    processor.processRawEvent('damage', JSON.stringify({ damageAmount: '150', targetName: 'C', weapon: 'R-301' }));
    processor.processRawEvent('damage', JSON.stringify({ damageAmount: '75', targetName: 'D', weapon: 'R-301' }));
    processor.processRawEvent('death', JSON.stringify({ attackerName: 'E', weapon: 'Kraber' }));

    const stats = processor.getSessionStats();
    expect(stats.kills).toBe(2);
    expect(stats.deaths).toBe(1);
    expect(stats.damage).toBe(225);
    expect(stats.headshots).toBe(1);
  });

  it('should reset session stats on new match', () => {
    // First match
    processor.processRawEvent('match_start', JSON.stringify({ mode: 'battle_royale' }));
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'A', weapon: 'R-301', headshot: false }));
    processor.processRawEvent('damage', JSON.stringify({ damageAmount: '200', targetName: 'B', weapon: 'R-301' }));
    processor.processRawEvent('match_end', JSON.stringify({}));

    // Check stats accumulated from first match
    const afterMatch1 = processor.getSessionStats();
    expect(afterMatch1.kills).toBe(1);
    expect(afterMatch1.damage).toBe(200);

    // Second match -- per-match stats should reset but session stats accumulate
    processor.processRawEvent('match_start', JSON.stringify({ mode: 'ranked' }));
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'C', weapon: 'Flatline', headshot: false }));

    const currentMatch = processor.getCurrentMatchStats();
    expect(currentMatch.kills).toBe(1); // only this match

    const sessionTotal = processor.getSessionStats();
    expect(sessionTotal.kills).toBe(2); // cumulative
  });

  // -----------------------------------------------------------------------
  // Malformed Events
  // -----------------------------------------------------------------------

  it('should handle malformed GEP events gracefully', () => {
    // Completely invalid JSON
    processor.processRawEvent('kill', '{not valid json');

    // Empty data
    processor.processRawEvent('kill', '');

    // Unknown event type
    processor.processRawEvent('unknown_event', JSON.stringify({ some: 'data' }));

    // Should not crash, and should not emit events for malformed input
    expect(emittedEvents).toHaveLength(0);
  });

  it('should handle null/undefined fields in GEP data gracefully', () => {
    processor.processRawEvent('kill', JSON.stringify({}));

    // Should still emit with defaults
    expect(emittedEvents).toHaveLength(1);
    if (emittedEvents[0].type === 'PLAYER_KILL') {
      expect(emittedEvents[0].victim).toBe('Unknown');
      expect(emittedEvents[0].weapon).toBe('Unknown');
      expect(emittedEvents[0].headshot).toBe(false);
    }
  });

  // -----------------------------------------------------------------------
  // Event Batching
  // -----------------------------------------------------------------------

  it('should batch events for IPC (not send individually)', () => {
    const batchCallback = vi.fn();
    processor.onBatch(batchCallback);

    // Fire several events quickly
    processor.processRawEvent('match_start', JSON.stringify({ mode: 'battle_royale' }));
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'A', weapon: 'R-301', headshot: false }));
    processor.processRawEvent('damage', JSON.stringify({ damageAmount: '100', targetName: 'B', weapon: 'R-301' }));

    // Flush the batch
    processor.flushBatch();

    expect(batchCallback).toHaveBeenCalledTimes(1);
    const batch = batchCallback.mock.calls[0][0];
    expect(batch).toHaveLength(3);
    expect(batch[0].type).toBe('MATCH_START');
    expect(batch[1].type).toBe('PLAYER_KILL');
    expect(batch[2].type).toBe('DAMAGE_DEALT');
  });
});
