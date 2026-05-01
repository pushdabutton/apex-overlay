// ============================================================
// GEP Manager -- Overwolf Game Event Provider lifecycle
// Initializes GEP with retry logic, routes events through
// EventProcessor, tracks match state, emits domain events.
//
// Key pattern from skill doc:
//   setRequiredFeatures MUST retry up to 10 times with 3s delay
// ============================================================

import { EventEmitter } from 'events';
import { EventProcessor } from './event-processor';
import { MatchStateMachine, MatchState } from './match-state';
import { APEX_GAME_ID, GEP_REQUIRED_FEATURES } from '../../shared/constants';

// -----------------------------------------------------------------------
// GEP Provider Interface -- abstraction over real Overwolf GEP or mock
// -----------------------------------------------------------------------

export interface GEPProvider {
  setRequiredFeatures(features: string[]): Promise<{
    success: boolean;
    supportedFeatures: string[];
  }>;
  /** Query current game state snapshot. Returns null if not available. */
  getInfo?(): Promise<unknown>;
  onNewEvents: {
    addListener(callback: (payload: { events: Array<{ name: string; data: string }> }) => void): void;
    removeListener(callback: (payload: { events: Array<{ name: string; data: string }> }) => void): void;
  };
  onInfoUpdates2: {
    addListener(callback: (payload: { info: Record<string, unknown> }) => void): void;
    removeListener(callback: (payload: { info: Record<string, unknown> }) => void): void;
  };
}

// GEP_REQUIRED_FEATURES is now defined in shared/constants.ts and re-exported here
// for backwards compatibility with any imports from this module.
export { GEP_REQUIRED_FEATURES } from '../../shared/constants';

// Retry configuration (per skill doc: 10 retries, 3s delay)
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

export class GEPManager extends EventEmitter {
  private provider: GEPProvider;
  private processor: EventProcessor;
  private stateMachine: MatchStateMachine;

  // Store bound listeners so we can remove them on destroy
  private boundOnNewEvents: ((payload: { events: Array<{ name: string; data: string }> }) => void) | null = null;
  private boundOnInfoUpdates: ((payload: { info: Record<string, unknown> }) => void) | null = null;

  constructor(provider: GEPProvider) {
    super();
    this.provider = provider;
    this.processor = new EventProcessor();
    this.stateMachine = new MatchStateMachine();

    // Wire processor domain events to GEPManager's event emitter
    this.processor.on('domain-event', (event) => {
      // Update state machine based on domain events
      this.updateStateMachine(event);
      // Re-emit for external listeners
      this.emit('domain-event', event);
    });
  }

  /**
   * Initialize GEP with retry logic.
   * Returns true if features registered successfully, false if all retries exhausted.
   */
  async initialize(): Promise<boolean> {
    console.log(`[GEP] Initializing for game ID ${APEX_GAME_ID}`);

    const registered = await this.registerFeaturesWithRetry();
    if (!registered) {
      console.error('[GEP] Failed to register features after all retries');
      return false;
    }

    // Subscribe to events
    this.boundOnNewEvents = (payload) => {
      this.processor.processEventBatch(payload);
    };
    this.provider.onNewEvents.addListener(this.boundOnNewEvents);

    // Subscribe to info updates
    this.boundOnInfoUpdates = (payload) => {
      this.processor.processInfoUpdate(payload);
    };
    this.provider.onInfoUpdates2.addListener(this.boundOnInfoUpdates);

    console.log(`[GEP] Initialized. Features: ${GEP_REQUIRED_FEATURES.join(', ')}`);
    return true;
  }

  /**
   * Get the current match state.
   */
  getMatchState(): MatchState {
    return this.stateMachine.getState();
  }

  /**
   * Manually return to IDLE (e.g., after post-match UI is dismissed).
   */
  returnToIdle(): void {
    this.stateMachine.transition('lobby');
  }

  /**
   * Query the current GEP game state snapshot.
   * Returns the raw snapshot from the provider, or null if not available.
   */
  async getInfo(): Promise<unknown> {
    if (this.provider.getInfo) {
      return this.provider.getInfo();
    }
    return null;
  }

  /**
   * Get the internal EventProcessor (for wiring to DB, coaching, etc.).
   */
  getProcessor(): EventProcessor {
    return this.processor;
  }

  /**
   * Get the internal MatchStateMachine.
   */
  getStateMachine(): MatchStateMachine {
    return this.stateMachine;
  }

  /**
   * Clean up event listeners. Call on app shutdown.
   */
  destroy(): void {
    if (this.boundOnNewEvents) {
      this.provider.onNewEvents.removeListener(this.boundOnNewEvents);
      this.boundOnNewEvents = null;
    }
    if (this.boundOnInfoUpdates) {
      this.provider.onInfoUpdates2.removeListener(this.boundOnInfoUpdates);
      this.boundOnInfoUpdates = null;
    }
    this.processor.removeAllListeners();
    this.removeAllListeners();
  }

  // -----------------------------------------------------------------------
  // Internal: retry logic for setRequiredFeatures
  // -----------------------------------------------------------------------

  private async registerFeaturesWithRetry(): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.provider.setRequiredFeatures(GEP_REQUIRED_FEATURES);
        if (result.success) {
          console.log(`[GEP] Features registered on attempt ${attempt + 1}`);
          return true;
        }
      } catch (err) {
        console.warn(`[GEP] Registration attempt ${attempt + 1} failed:`, err);
      }

      // Don't delay after last attempt
      if (attempt < MAX_RETRIES - 1) {
        await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Internal: map domain events to state machine transitions
  // -----------------------------------------------------------------------

  private updateStateMachine(event: { type: string }): void {
    switch (event.type) {
      case 'GAME_PHASE': {
        const phaseEvent = event as { type: 'GAME_PHASE'; phase: string };
        if (phaseEvent.phase === 'legend_select') {
          this.stateMachine.transition('legend_select');
        } else if (phaseEvent.phase === 'lobby') {
          this.stateMachine.transition('lobby');
        }
        break;
      }
      case 'MATCH_START':
        this.stateMachine.transition('match_start');
        break;
      case 'MATCH_END':
        this.stateMachine.transition('match_end');
        break;
    }
  }
}
