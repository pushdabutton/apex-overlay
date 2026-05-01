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
//
// CRITICAL: ow-electron sends individual key-value info updates,
// NOT nested objects. Each update arrives as:
//   { gameId, feature, category, key, value }
// where `value` is often a JSON string that needs parsing.
//
// We transform each update into the format EventProcessor expects:
//   { info: { [key]: parsedValue } }
// ============================================================

import type { GEPProvider } from './gep-manager';
import { APEX_GAME_ID } from '../../shared/constants';
import { getGEPRawLogger } from './gep-raw-logger';

/**
 * Minimal type declarations for ow-electron's GEP package.
 * The full types come from @overwolf/ow-electron-packages-types
 * at build time, but we define the shape we actually use here
 * so the adapter compiles standalone.
 */

/** Shape of a game event from ow-electron GEP */
interface OwGepGameEvent {
  name: string;
  data: string;
}

/** Real shape of info updates from ow-electron GEP -- individual key-value pairs */
interface OwGepInfoUpdate {
  gameId: number;
  feature: string;
  category: string;
  key: string;
  value: string;
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
 * Try to parse a string as JSON. If it fails or the input is not
 * a string, return the original value unchanged.
 */
function tryParseJson(value: string): unknown {
  if (typeof value !== 'string') return value;
  // Quick check: if it doesn't look like JSON, skip parsing
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
    (e: unknown, gameId: number, event: unknown) => void
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
          const handler = (_e: unknown, gameId: number, event: unknown): void => {
            // Only forward events for Apex Legends
            if (gameId === APEX_GAME_ID) {
              // Log raw event BEFORE any processing for debugging
              getGEPRawLogger().logGameEvent(gameId, event);
              console.log('[ow-electron GEP] Raw game event:', JSON.stringify(event).slice(0, 500));

              // Try to extract event name and data from whatever shape arrives.
              // The ow-electron GEP may use different field names than expected.
              const eventObj = event as Record<string, unknown>;
              const name = (eventObj.name ?? eventObj.key ?? eventObj.event ?? eventObj.type) as string;
              const rawData = eventObj.data ?? eventObj.value ?? JSON.stringify(eventObj);
              const data = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);

              if (name) {
                callback({ events: [{ name, data }] });
              }
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
            if (gameId !== APEX_GAME_ID) return;

            // Log raw info update BEFORE any processing for debugging
            getGEPRawLogger().logInfoUpdate(gameId, info);
            console.log('[ow-electron GEP] Raw info update:', JSON.stringify(info).slice(0, 500));

            // ow-electron GEP sends individual key-value updates:
            //   { gameId, feature, category, key, value }
            // where value is often a JSON string that needs parsing.
            //
            // We transform this into: { info: { key: parsedValue } }
            // which is the format EventProcessor.processInfoUpdate expects.
            const update = info as OwGepInfoUpdate;
            if (update && typeof update.key === 'string' && update.value !== undefined) {
              const parsedValue = tryParseJson(update.value);
              callback({
                info: {
                  key: update.key,
                  value: parsedValue,
                  feature: update.feature,
                  category: update.category,
                },
              });
            } else if (typeof info === 'object' && info !== null) {
              // Fallback for unexpected formats -- pass through as-is
              const infoObj = (info as Record<string, unknown>).info as Record<string, unknown>
                ?? (info as Record<string, unknown>);
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
