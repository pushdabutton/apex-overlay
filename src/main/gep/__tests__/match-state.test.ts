// ============================================================
// Match State Machine -- RED Tests (TDD Phase 1)
// Tests for the match lifecycle state machine
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { MatchStateMachine, MatchState } from '../match-state';

describe('MatchStateMachine', () => {
  it('should start in IDLE state', () => {
    const machine = new MatchStateMachine();
    expect(machine.getState()).toBe(MatchState.IDLE);
  });

  it('should transition IDLE -> LEGEND_SELECT on legend_selection phase', () => {
    const machine = new MatchStateMachine();
    machine.transition('legend_select');
    expect(machine.getState()).toBe(MatchState.LEGEND_SELECT);
  });

  it('should transition LEGEND_SELECT -> IN_MATCH on match_start', () => {
    const machine = new MatchStateMachine();
    machine.transition('legend_select');
    machine.transition('match_start');
    expect(machine.getState()).toBe(MatchState.IN_MATCH);
  });

  it('should transition IN_MATCH -> MATCH_ENDED on match_end', () => {
    const machine = new MatchStateMachine();
    machine.transition('legend_select');
    machine.transition('match_start');
    machine.transition('match_end');
    expect(machine.getState()).toBe(MatchState.MATCH_ENDED);
  });

  it('should transition MATCH_ENDED -> IDLE on return to lobby', () => {
    const machine = new MatchStateMachine();
    machine.transition('legend_select');
    machine.transition('match_start');
    machine.transition('match_end');
    machine.transition('lobby');
    expect(machine.getState()).toBe(MatchState.IDLE);
  });

  it('should reject invalid transitions', () => {
    const machine = new MatchStateMachine();
    // Cannot go from IDLE directly to IN_MATCH without legend_select first
    const result = machine.transition('match_end');
    expect(result).toBe(false);
    expect(machine.getState()).toBe(MatchState.IDLE);
  });

  it('should allow IDLE -> IN_MATCH directly via match_start (late join)', () => {
    // Sometimes the app starts mid-match and we get match_start without legend_select
    const machine = new MatchStateMachine();
    const result = machine.transition('match_start');
    expect(result).toBe(true);
    expect(machine.getState()).toBe(MatchState.IN_MATCH);
  });

  it('should emit state change events', () => {
    const machine = new MatchStateMachine();
    const changes: Array<{ from: MatchState; to: MatchState }> = [];

    machine.onStateChange((from, to) => {
      changes.push({ from, to });
    });

    machine.transition('legend_select');
    machine.transition('match_start');
    machine.transition('match_end');
    machine.transition('lobby');

    expect(changes).toHaveLength(4);
    expect(changes[0]).toEqual({ from: MatchState.IDLE, to: MatchState.LEGEND_SELECT });
    expect(changes[1]).toEqual({ from: MatchState.LEGEND_SELECT, to: MatchState.IN_MATCH });
    expect(changes[2]).toEqual({ from: MatchState.IN_MATCH, to: MatchState.MATCH_ENDED });
    expect(changes[3]).toEqual({ from: MatchState.MATCH_ENDED, to: MatchState.IDLE });
  });

  it('should not emit state change on rejected transition', () => {
    const machine = new MatchStateMachine();
    const changes: Array<{ from: MatchState; to: MatchState }> = [];

    machine.onStateChange((from, to) => {
      changes.push({ from, to });
    });

    machine.transition('match_end'); // invalid from IDLE
    expect(changes).toHaveLength(0);
  });

  it('should support reset to IDLE from any state', () => {
    const machine = new MatchStateMachine();
    machine.transition('legend_select');
    machine.transition('match_start');

    // Force reset (e.g., Overwolf restart detection)
    machine.reset();
    expect(machine.getState()).toBe(MatchState.IDLE);
  });

  it('should handle full lifecycle repeatedly', () => {
    const machine = new MatchStateMachine();

    // First match
    machine.transition('legend_select');
    machine.transition('match_start');
    machine.transition('match_end');
    machine.transition('lobby');
    expect(machine.getState()).toBe(MatchState.IDLE);

    // Second match
    machine.transition('legend_select');
    machine.transition('match_start');
    machine.transition('match_end');
    machine.transition('lobby');
    expect(machine.getState()).toBe(MatchState.IDLE);
  });
});
