// ============================================================
// ow-electron GEP Adapter -- Wraps the real ow-electron GEP
// EventEmitter API and presents the GEPProvider interface that
// GEPManager expects.
//
// ow-electron GEP API shape:
//   app.overwolf.packages.gep
//     .setRequiredFeatures(gameId, features)
//     .on('new-game-event', (e, gameId, ...args) => ...)
//     .on('new-info-update', (e, gameId, ...args) => ...)
//     .on('game-detected', (e, gameId, name, info) => { e.enable(); })
// ============================================================

import type { GEPProvider } from './gep-manager';
import { APEX_GAME_ID } from '../../shared/constants';

/**
 * Minimal type declarations for ow-electron's GEP package.
 * The full types come from @overwolf/ow-electron-packages-types
 * at build time, but we define the shape we actually use here
 * so the adapter compiles standalone.
 */
interface OwGepGameEvent {
  name: string;
  data: string;
}

interface OwGepInfoUpdate {
  info: Record<string, unknown>;
}

interface OwGepDetectedEvent {
  enable(): void;
}

interface OwGepPackage {
  setRequiredFeatures(gameId: number, features: string[]): Promise<unknown>;
  on(event: 'new-game-event', handler: (e: unknown, gameId: number, event: OwGepGameEvent) => void): void;
  on(event: 'new-info-update', handler: (e: unknown, gameId: number, info: OwGepInfoUpdate) => void): void;
  on(event: 'game-detected', handler: (e: OwGepDetectedEvent, gameId: number, name: string, info: unknown) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Adapter that wraps the ow-electron GEP EventEmitter API and
 * exposes it as the GEPProvider interface (addListener/removeListener
 * callback pattern) that GEPManager expects.
 *
 * This keeps GEPManager completely unaware of whether it is talking
 * to the real ow-electron GEP or the MockGEP.
 */
export class OwElectronGEPAdapter {
  private gep: OwGepPackage;

  // Maps from GEPProvider-style callbacks to the ow-electron-style handlers
  // so we can properly remove listeners on destroy.
  private eventHandlerMap = new Map<
    (payload: { events: Array<{ name: string; data: string }> }) => void,
    (e: unknown, gameId: number, event: OwGepGameEvent) => void
  >();
  private infoHandlerMap = new Map<
    (payload: { info: Record<string, unknown> }) => void,
    (e: unknown, gameId: number, info: OwGepInfoUpdate) => void
  >();

  constructor(gep: OwGepPackage) {
    this.gep = gep;

    // Auto-enable any detected game so GEP starts sending events.
    // Without this, GEP silently ignores games.
    this.gep.on('game-detected', (e: OwGepDetectedEvent, _gameId: number) => {
      e.enable();
    });
  }

  /**
   * Return a GEPProvider-compatible interface backed by real ow-electron GEP.
   */
  asProvider(): GEPProvider {
    return {
      setRequiredFeatures: async (features: string[]) => {
        try {
          await this.gep.setRequiredFeatures(APEX_GAME_ID, features);
          // ow-electron's setRequiredFeatures does not return a structured
          // result like ow-native. If it resolves without error, features
          // are registered. We return the shape GEPManager expects.
          return { success: true, supportedFeatures: [...features] };
        } catch (err) {
          console.warn('[ow-electron GEP] setRequiredFeatures failed:', err);
          return { success: false, supportedFeatures: [] };
        }
      },

      onNewEvents: {
        addListener: (callback: (payload: { events: Array<{ name: string; data: string }> }) => void) => {
          const handler = (_e: unknown, gameId: number, event: OwGepGameEvent): void => {
            // Only forward events for Apex Legends
            if (gameId === APEX_GAME_ID) {
              callback({ events: [{ name: event.name, data: event.data }] });
            }
          };
          this.eventHandlerMap.set(callback, handler);
          this.gep.on('new-game-event', handler);
        },
        removeListener: (callback: (payload: { events: Array<{ name: string; data: string }> }) => void) => {
          const handler = this.eventHandlerMap.get(callback);
          if (handler) {
            this.gep.removeListener('new-game-event', handler as (...args: unknown[]) => void);
            this.eventHandlerMap.delete(callback);
          }
        },
      },

      onInfoUpdates2: {
        addListener: (callback: (payload: { info: Record<string, unknown> }) => void) => {
          const handler = (_e: unknown, gameId: number, info: unknown): void => {
            if (gameId === APEX_GAME_ID) {
              // Log the raw info shape to understand ow-electron's format
              console.log('[ow-electron GEP] Raw info update:', JSON.stringify(info).slice(0, 500));
              // Try multiple possible data shapes
              const infoObj = (typeof info === 'object' && info !== null)
                ? ((info as Record<string, unknown>).info as Record<string, unknown>) ?? (info as Record<string, unknown>)
                : {};
              callback({ info: infoObj });
            }
          };
          this.infoHandlerMap.set(callback, handler);
          this.gep.on('new-info-update', handler);
        },
        removeListener: (callback: (payload: { info: Record<string, unknown> }) => void) => {
          const handler = this.infoHandlerMap.get(callback);
          if (handler) {
            this.gep.removeListener('new-info-update', handler as (...args: unknown[]) => void);
            this.infoHandlerMap.delete(callback);
          }
        },
      },
    };
  }
}
