// ============================================================
// GEP Manager -- Overwolf Game Event Provider lifecycle
// Initializes GEP, registers features, routes events
// ============================================================

import type Database from 'better-sqlite3';
import { EventProcessor } from './event-processor';
import { CoachingEngine } from '../coaching/engine';
import { APEX_GAME_ID } from '../../shared/constants';

// Required GEP features for Apex Legends
const REQUIRED_FEATURES = [
  'kill',
  'death',
  'assist',
  'knockdown',
  'damage',
  'revive',
  'respawn',
  'match_info',
  'game_info',
  'rank',
  'me',
] as const;

export class GEPManager {
  private processor: EventProcessor;

  constructor(db: Database.Database, coaching: CoachingEngine) {
    this.processor = new EventProcessor(db, coaching);
  }

  async initialize(): Promise<void> {
    // NOTE: The actual Overwolf GEP API calls depend on the ow-electron SDK.
    // This is the integration point. In development without Overwolf, this
    // will be stubbed with mock events.
    //
    // Production integration:
    //   const { overwolf } = require('@aspect-build/aspect-overwolf-electron');
    //   await overwolf.games.events.setRequiredFeatures([...REQUIRED_FEATURES]);
    //   overwolf.games.events.onNewEvents.addListener((event) => {
    //     this.processor.processEvent(event);
    //   });
    //   overwolf.games.events.onInfoUpdates2.addListener((info) => {
    //     this.processor.processInfoUpdate(info);
    //   });

    console.log(`[GEP] Initialized for game ID ${APEX_GAME_ID}`);
    console.log(`[GEP] Required features: ${REQUIRED_FEATURES.join(', ')}`);
  }

  /**
   * For development: inject a mock event as if it came from GEP.
   * Useful for testing the pipeline without running Apex Legends.
   */
  injectMockEvent(eventName: string, data: string): void {
    this.processor.processEvent({
      events: [{ name: eventName, data }],
    });
  }

  getProcessor(): EventProcessor {
    return this.processor;
  }
}
