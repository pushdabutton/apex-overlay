// ============================================================
// EventProcessor: resolveCurrentMode should check gameMode from
// GEP snapshot when modeName is not yet available.
//
// Bug: game_mode: "#GAME_MODE_RANKED" arrives via getInfo snapshot
// but the first match resolves to "unknown" because modeName hasn't
// been set yet, and gameMode contains the raw localization key
// format that needs to be matched.
//
// The existing resolveCurrentMode already checks gameMode, and
// "#GAME_MODE_RANKED".toLowerCase() = "#game_mode_ranked" which
// includes "ranked". BUT: if game_mode arrives as a key-value
// info update with the value being a GEP localization string
// like "#GAME_MODE_RANKED", we need to confirm it flows through
// the processKeyValueUpdate -> gameMode field correctly.
//
// Additionally, resolveCurrentMode should handle more GEP mode
// patterns: #PL_Ranked_Leagues, #GAME_MODE_RANKED, etc.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventProcessor } from '../../src/main/gep/event-processor';
import type { DomainEvent } from '../../src/shared/types';

describe('EventProcessor: resolveCurrentMode with GEP snapshot game_mode', () => {
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

  it('should resolve "ranked" when game_mode is "#GAME_MODE_RANKED"', () => {
    // Simulate game_mode arriving from getInfo snapshot BEFORE the match starts
    processor.processInfoUpdate({
      info: { key: 'game_mode', value: '#GAME_MODE_RANKED', feature: 'game_info', category: 'game_info' },
    });

    // Now the match starts via phase transition
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    const matchStart = emittedEvents.find((e) => e.type === 'MATCH_START');
    expect(matchStart).toBeDefined();
    expect(matchStart!.type === 'MATCH_START' && matchStart!.mode).toBe('ranked');
  });

  it('should resolve "ranked" when game_mode is "#PL_Ranked_Leagues"', () => {
    processor.processInfoUpdate({
      info: { key: 'game_mode', value: '#PL_Ranked_Leagues', feature: 'game_info', category: 'game_info' },
    });

    processor.processInfoUpdate({
      info: { key: 'phase', value: 'aircraft', feature: 'game_info', category: 'game_info' },
    });

    const matchStart = emittedEvents.find((e) => e.type === 'MATCH_START');
    expect(matchStart).toBeDefined();
    expect(matchStart!.type === 'MATCH_START' && matchStart!.mode).toBe('ranked');
  });

  it('should resolve "battle_royale" when game_mode is "#PL_TRIO"', () => {
    processor.processInfoUpdate({
      info: { key: 'game_mode', value: '#PL_TRIO', feature: 'game_info', category: 'game_info' },
    });

    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    const matchStart = emittedEvents.find((e) => e.type === 'MATCH_START');
    expect(matchStart).toBeDefined();
    expect(matchStart!.type === 'MATCH_START' && matchStart!.mode).toBe('battle_royale');
  });

  it('should resolve "battle_royale" when game_mode is "#PL_DUO"', () => {
    processor.processInfoUpdate({
      info: { key: 'game_mode', value: '#PL_DUO', feature: 'game_info', category: 'game_info' },
    });

    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    const matchStart = emittedEvents.find((e) => e.type === 'MATCH_START');
    expect(matchStart!.type === 'MATCH_START' && matchStart!.mode).toBe('battle_royale');
  });

  it('should prefer modeName over gameMode when both are set', () => {
    // gameMode is set first
    processor.processInfoUpdate({
      info: { key: 'game_mode', value: '#PL_TRIO', feature: 'game_info', category: 'game_info' },
    });
    // modeName arrives later (more human-readable)
    processor.processInfoUpdate({
      info: { key: 'mode_name', value: 'Ranked', feature: 'game_info', category: 'game_info' },
    });

    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    const matchStart = emittedEvents.find((e) => e.type === 'MATCH_START');
    // modeName "Ranked" takes priority over gameMode "#PL_TRIO"
    expect(matchStart!.type === 'MATCH_START' && matchStart!.mode).toBe('ranked');
  });

  it('should resolve "unknown" when no mode info is available', () => {
    // No game_mode or mode_name set
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    const matchStart = emittedEvents.find((e) => e.type === 'MATCH_START');
    expect(matchStart!.type === 'MATCH_START' && matchStart!.mode).toBe('unknown');
  });
});
