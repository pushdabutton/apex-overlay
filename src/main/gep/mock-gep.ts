// ============================================================
// Mock GEP -- Development-time mock of the Overwolf Game
// Event Provider. Simulates a full match with realistic
// events so the pipeline can be tested without the game.
//
// Toggle: set USE_MOCK_GEP=true in environment
// ============================================================

import type { GEPProvider } from './gep-manager';

type EventListener = (payload: { events: Array<{ name: string; data: string }> }) => void;
type InfoListener = (payload: { info: Record<string, unknown> }) => void;

// Realistic enemy names for simulation
const ENEMY_NAMES = [
  'TTV_Wraith', 'xXPredatorXx', 'GibbyMain420', 'OctaneFanboy',
  'SeerIsOP', 'FlatlineGod', 'WingmanFlicks', 'CasualPatty',
  'SilverSurfer', 'ApexNoob42', 'PathfinderPro', 'ZiplineKing',
  'HorizonScience', 'BangaloreSmoker', 'LifelineSoloQ',
];

const WEAPONS = [
  'R-301', 'Flatline', 'R-99', 'Peacekeeper',
  'Wingman', 'Mastiff', 'Kraber', 'Volt',
  'Havoc', 'Devotion', 'Sentinel', 'Longbow',
];

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDamage(): number {
  // Realistic damage range: 14 (single Mozam pellet) to 280 (Kraber headshot-ish)
  return Math.floor(Math.random() * 266) + 14;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class MockGEP {
  private eventListeners: EventListener[] = [];
  private infoListeners: InfoListener[] = [];

  /**
   * Return a GEPProvider-compatible interface backed by this mock.
   */
  asProvider(): GEPProvider {
    return {
      setRequiredFeatures: async (features: string[]) => {
        return { success: true, supportedFeatures: [...features] };
      },
      onNewEvents: {
        addListener: (cb: EventListener) => {
          this.eventListeners.push(cb);
        },
        removeListener: (cb: EventListener) => {
          this.eventListeners = this.eventListeners.filter(l => l !== cb);
        },
      },
      onInfoUpdates2: {
        addListener: (cb: InfoListener) => {
          this.infoListeners.push(cb);
        },
        removeListener: (cb: InfoListener) => {
          this.infoListeners = this.infoListeners.filter(l => l !== cb);
        },
      },
    };
  }

  /**
   * Inject a single custom event (for test scenarios).
   */
  injectEvent(eventName: string, data: Record<string, unknown>): void {
    this.fireEvent(eventName, data);
  }

  /**
   * Inject a custom info update.
   */
  injectInfo(info: Record<string, unknown>): void {
    for (const listener of this.infoListeners) {
      listener({ info });
    }
  }

  /**
   * Simulate a full match sequence with realistic timing and events.
   * Events fired in order:
   *   match_start -> legend_select -> kills/damage/knockdowns -> death -> match_end
   */
  async simulateMatch(): Promise<void> {
    // 1. Match start
    this.fireEvent('match_start', { mode: 'battle_royale' });
    await delay(500);

    // 2. Legend selection
    this.fireEvent('legend_select', { legendName: 'Wraith' });
    await delay(500);

    // 3. Land phase -- initial combat
    const numKills = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numKills; i++) {
      const weapon = randomPick(WEAPONS);
      const victim = randomPick(ENEMY_NAMES);
      const headshot = Math.random() < 0.3;

      // Damage event before kill
      this.fireEvent('damage', {
        damageAmount: String(randomDamage()),
        targetName: victim,
        weapon,
        headshot: String(headshot),
      });
      await delay(200);

      this.fireEvent('kill', {
        victimName: victim,
        weapon,
        headshot,
      });
      await delay(300);
    }

    // 4. Additional damage events
    const numDamageEvents = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numDamageEvents; i++) {
      this.fireEvent('damage', {
        damageAmount: String(randomDamage()),
        targetName: randomPick(ENEMY_NAMES),
        weapon: randomPick(WEAPONS),
        headshot: String(Math.random() < 0.2),
      });
      await delay(200);
    }

    // 5. Maybe a knockdown
    if (Math.random() < 0.5) {
      this.fireEvent('knockdown', {
        victimName: randomPick(ENEMY_NAMES),
      });
      await delay(300);
    }

    // 6. Player death
    this.fireEvent('death', {
      attackerName: randomPick(ENEMY_NAMES),
      weapon: randomPick(WEAPONS),
    });
    await delay(500);

    // 7. Match end
    this.fireEvent('match_end', {});
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private fireEvent(name: string, data: Record<string, unknown>): void {
    const payload = {
      events: [{ name, data: JSON.stringify(data) }],
    };
    for (const listener of this.eventListeners) {
      listener(payload);
    }
  }
}
