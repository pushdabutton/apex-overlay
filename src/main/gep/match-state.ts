// ============================================================
// Match State Machine -- Tracks match lifecycle
// States: IDLE -> LEGEND_SELECT -> IN_MATCH -> MATCH_ENDED -> IDLE
// ============================================================

export enum MatchState {
  IDLE = 'IDLE',
  LEGEND_SELECT = 'LEGEND_SELECT',
  IN_MATCH = 'IN_MATCH',
  MATCH_ENDED = 'MATCH_ENDED',
}

// Valid transition triggers
export type MatchTransition = 'legend_select' | 'match_start' | 'match_end' | 'lobby';

type StateChangeCallback = (from: MatchState, to: MatchState) => void;

/**
 * Defines which transitions are valid from each state.
 * Key = current state, value = map of trigger -> next state.
 */
const TRANSITIONS: Record<MatchState, Partial<Record<MatchTransition, MatchState>>> = {
  [MatchState.IDLE]: {
    legend_select: MatchState.LEGEND_SELECT,
    match_start: MatchState.IN_MATCH, // late join -- app started mid-match
  },
  [MatchState.LEGEND_SELECT]: {
    match_start: MatchState.IN_MATCH,
  },
  [MatchState.IN_MATCH]: {
    match_end: MatchState.MATCH_ENDED,
  },
  [MatchState.MATCH_ENDED]: {
    lobby: MatchState.IDLE,
  },
};

export class MatchStateMachine {
  private state: MatchState = MatchState.IDLE;
  private listeners: StateChangeCallback[] = [];

  getState(): MatchState {
    return this.state;
  }

  /**
   * Attempt a state transition. Returns true if the transition was valid
   * and applied, false if it was rejected.
   */
  transition(trigger: MatchTransition): boolean {
    const validTransitions = TRANSITIONS[this.state];
    const nextState = validTransitions[trigger];

    if (nextState === undefined) {
      return false;
    }

    const from = this.state;
    this.state = nextState;

    for (const cb of this.listeners) {
      cb(from, nextState);
    }

    return true;
  }

  /**
   * Force reset to IDLE. Used when detecting Overwolf restart mid-game
   * or other abnormal conditions.
   */
  reset(): void {
    this.state = MatchState.IDLE;
  }

  /**
   * Register a callback that fires on every successful state change.
   */
  onStateChange(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  /**
   * Remove a specific state change callback.
   */
  offStateChange(callback: StateChangeCallback): void {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }
}
