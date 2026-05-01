// ============================================================
// Event Processor -- Converts raw GEP events to typed domain
// events, tracks session/match stats, supports event batching.
//
// This is a PURE processing layer with no DB or coaching
// dependencies. The GEP Manager wires it to those systems.
// ============================================================

import { EventEmitter } from 'events';
import { mapGepEvent } from './event-map';
import { cleanLegendName } from '../../shared/utils';
import type { DomainEvent, GameMode } from '../../shared/types';

export interface SessionStats {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  knockdowns: number;
  revives: number;
  respawns: number;
  matchesPlayed: number;
}

export interface WeaponKillEntry {
  weapon: string;
  kills: number;
  headshots: number;
  damage: number;
}

export interface MatchStats {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  knockdowns: number;
  revives: number;
  respawns: number;
}

type BatchCallback = (events: DomainEvent[]) => void;

function emptyMatchStats(): MatchStats {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    damage: 0,
    headshots: 0,
    knockdowns: 0,
    revives: 0,
    respawns: 0,
  };
}

function emptySessionStats(): SessionStats {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    damage: 0,
    headshots: 0,
    knockdowns: 0,
    revives: 0,
    respawns: 0,
    matchesPlayed: 0,
  };
}

// Duration in ms after MATCH_END during which tabs auto-start is suppressed.
// GEP may send stale tabs data a few seconds after the match ends. Without
// this cooldown, the stale tabs with kills > 0 would trigger a spurious
// MATCH_START that resets the PostMatch display to all zeros.
const TABS_AUTOSTART_COOLDOWN_MS = 10_000;

export class EventProcessor extends EventEmitter {
  private matchStartTime = 0;
  private currentMatch: MatchStats = emptyMatchStats();
  private session: SessionStats = emptySessionStats();
  private inMatch = false;
  private pendingBatch: DomainEvent[] = [];
  private batchCallbacks: BatchCallback[] = [];

  // Timestamp of the last MATCH_END, used to suppress spurious tabs auto-start
  private lastMatchEndTime = 0;

  // Weapon kill accumulator: weapon -> { kills, headshots, damage }
  private weaponKills = new Map<string, { kills: number; headshots: number; damage: number }>();

  // Snapshot of session stats at match start, used to reconcile at match end.
  // When tabs data (authoritative game totals) is available, the match totals
  // may be higher than what individual events accumulated. We use this snapshot
  // to calculate: session_stat = snapshot + max(event_increments, tabs_total).
  private sessionAtMatchStart: SessionStats = emptySessionStats();

  /**
   * Process a single raw GEP event by name and data string.
   * Converts it to a domain event, updates stats, and emits.
   */
  processRawEvent(eventName: string, rawData: string): void {
    const domainEvent = mapGepEvent(eventName, rawData, {
      matchStartTime: this.matchStartTime,
    });

    if (!domainEvent) {
      return;
    }

    this.applyToStats(domainEvent);
    this.pendingBatch.push(domainEvent);
    this.emit('domain-event', domainEvent);
  }

  /**
   * Process a batch of raw GEP events (as they arrive from the provider).
   */
  processEventBatch(payload: { events: Array<{ name: string; data: string }> }): void {
    for (const rawEvent of payload.events) {
      this.processRawEvent(rawEvent.name, rawEvent.data);
    }
  }

  // --- Player state tracked from info updates ---
  private playerName: string | null = null;
  private gameMode: string | null = null;
  private modeName: string | null = null;
  private equippedWeapons: Record<string, string> = {};
  private playerLocation: { x: number; y: number; z: number } | null = null;
  private currentMapName: string | null = null;

  /**
   * Get the player name detected from GEP info updates.
   */
  getPlayerName(): string | null {
    return this.playerName;
  }

  /**
   * Get the current game mode info detected from GEP info updates.
   */
  getGameMode(): { gameMode: string | null; modeName: string | null } {
    return { gameMode: this.gameMode, modeName: this.modeName };
  }

  /**
   * Get the currently equipped weapons detected from GEP info updates.
   */
  getEquippedWeapons(): Record<string, string> {
    return { ...this.equippedWeapons };
  }

  /**
   * Get the latest player location from GEP info updates.
   */
  getPlayerLocation(): { x: number; y: number; z: number } | null {
    return this.playerLocation ? { ...this.playerLocation } : null;
  }

  /**
   * Get the current map name from GEP info updates.
   */
  getMapName(): string | null {
    return this.currentMapName;
  }

  /**
   * Process GEP info updates (some data arrives as info, not events).
   *
   * Handles two formats:
   *
   * 1. ow-electron key-value format (real GEP):
   *    { info: { key: "tabs", value: { kills: 2, ... }, feature: "match_info", category: "match_info" } }
   *
   * 2. Legacy / MockGEP nested object format:
   *    { info: { legendName: "Wraith", phase: "playing" } }
   */
  processInfoUpdate(payload: { info: Record<string, unknown> }): void {
    const info = payload?.info;
    if (!info || typeof info !== 'object') return;

    // ow-electron key-value format: { key, value, feature, category }
    if (typeof info.key === 'string' && info.value !== undefined) {
      this.processKeyValueUpdate(info.key, info.value, info.feature as string | undefined);
      return;
    }

    // --- Legacy / MockGEP nested object format (backward compatible) ---

    // Legend selection
    const legendName = (info.legendName as string)
      ?? ((info.me as Record<string, unknown>)?.legendName as string)
      ?? ((info.me as Record<string, unknown>)?.legend as string);

    if (legendName && typeof legendName === 'string') {
      const event: DomainEvent = {
        type: 'LEGEND_SELECTED',
        legend: cleanLegendName(legendName),
        timestamp: Date.now(),
      };
      this.pendingBatch.push(event);
      this.emit('domain-event', event);
    }

    // Phase changes
    if (info.phase && typeof info.phase === 'string') {
      const event = mapGepEvent('phase', JSON.stringify({ phase: info.phase }), {
        matchStartTime: this.matchStartTime,
      });
      if (event) {
        this.pendingBatch.push(event);
        this.emit('domain-event', event);
      }
    }
  }

  /**
   * Handle a single key-value info update from ow-electron GEP.
   *
   * Known keys:
   *   - "tabs"            -> live match stats { kills, assists, teams, players, damage }
   *   - "name"            -> player name (string)
   *   - "phase"           -> game phase: "lobby" | "legend_selection" | "aircraft" | "freefly" | "landed" | "loading_screen" | "match_summary"
   *   - "weapons"         -> equipped weapons { weapon0, weapon1 }
   *   - "game_mode"       -> internal game mode string (e.g., "#PL_TITLE_UNHINGED")
   *   - "mode_name"       -> human-readable mode name (e.g., "Wildcard")
   *   - "location"        -> player position { x, y, z }
   *   - "player"          -> player info { player_name, in_game_player_name }
   *   - "legendName"      -> selected legend name
   *   - "legendSelect_X"  -> team legend selection { playerName, legendName, selectionOrder, lead, is_local }
   *   - "match_summary"   -> { rank, teams, squadKills }
   *   - "match_state"     -> "active" | "inactive"
   *   - "map_id"/"map_name" -> current map identifier/name
   *   - "victory"         -> true/false for win/loss
   *   - "totalDamageDealt" -> running damage total
   *   - "me"              -> player info bundle with legend name
   */
  private processKeyValueUpdate(key: string, value: unknown, feature?: string): void {
    switch (key) {
      case 'tabs': {
        // Live match stats from match_info feature
        // value: { kills, assists, teams, players, damage, knockdowns, cash, ... }
        //
        // CRITICAL: GEP sends tabs:null after match end to clear post-match data.
        // If we process null tabs, it resets currentMatch stats to zeros, which
        // causes the post-match display to show 0 kills / 0 damage even though
        // the correct data was captured during the match. Skip null tabs entirely.
        if (value === null || value === undefined) {
          console.log('[EventProcessor] Ignoring null/undefined tabs update (GEP post-match clear)');
          return;
        }

        const tabs = typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)
          : {};
        const kills = this.safeInt(tabs.kills);
        const assists = this.safeInt(tabs.assists);
        const damage = this.safeInt(tabs.damage);
        const teams = this.safeInt(tabs.teams);
        const players = this.safeInt(tabs.players);
        const knockdowns = this.safeInt(tabs.knockdowns);

        console.log(`[EventProcessor] tabs update: kills=${kills} assists=${assists} damage=${damage} knockdowns=${knockdowns}`);

        // Emit a live stats update event so the UI can react
        this.emit('live-stats', { kills, assists, damage, teams, players });

        // Update current match stats from the authoritative game data.
        // GEP tabs gives us cumulative totals for the current match,
        // so we set them directly rather than incrementing.
        //
        // CRITICAL: Accept tabs data even when NOT explicitly in match.
        // ow-electron GEP sometimes sends tabs updates before the phase
        // transition that triggers MATCH_START. If tabs arrive with data,
        // a match IS happening -- auto-start it to avoid all-zeros.
        //
        // BUT: Suppress auto-start during the cooldown window after MATCH_END.
        // GEP may send stale tabs data a few seconds after the match ends.
        // Without this guard, stale tabs with kills > 0 would trigger a
        // spurious MATCH_START that resets the PostMatch display to all zeros.
        const timeSinceMatchEnd = Date.now() - this.lastMatchEndTime;
        const inCooldown = this.lastMatchEndTime > 0 && timeSinceMatchEnd < TABS_AUTOSTART_COOLDOWN_MS;

        if (!this.inMatch && (kills > 0 || damage > 0 || assists > 0) && !inCooldown) {
          console.log('[EventProcessor] MATCH AUTO-START: tabs data arrived before phase transition');
          const autoStart: DomainEvent = {
            type: 'MATCH_START',
            timestamp: Date.now(),
            mode: this.resolveCurrentMode(),
          };
          this.applyToStats(autoStart);
          this.pendingBatch.push(autoStart);
          this.emit('domain-event', autoStart);
        } else if (!this.inMatch && inCooldown && (kills > 0 || damage > 0 || assists > 0)) {
          console.log(`[EventProcessor] Suppressed tabs auto-start (cooldown: ${timeSinceMatchEnd}ms < ${TABS_AUTOSTART_COOLDOWN_MS}ms)`);
        }

        if (this.inMatch) {
          this.currentMatch.kills = kills;
          this.currentMatch.assists = assists;
          this.currentMatch.damage = damage;
          if (knockdowns > 0) {
            this.currentMatch.knockdowns = knockdowns;
          }
        }
        break;
      }

      case 'name': {
        // Player name -- simple string value
        if (typeof value === 'string' && value.length > 0) {
          this.playerName = value;
          this.emit('player-name', value);
        }
        break;
      }

      case 'player': {
        // Player info object: { player_name, in_game_player_name }
        if (typeof value === 'object' && value !== null) {
          const playerObj = value as Record<string, unknown>;
          const name = (playerObj.player_name as string) ?? (playerObj.in_game_player_name as string);
          if (name && typeof name === 'string') {
            this.playerName = name;
            this.emit('player-name', name);
          }
        }
        break;
      }

      case 'phase': {
        // Game phase transition -- also synthesize MATCH_START / MATCH_END
        // from phase changes because ow-electron GEP does NOT send explicit
        // match_start / match_end game events. Instead it sends phase updates.
        //
        // Official Apex GEP BR phase values:
        //   "lobby"            -> main menu/lobby
        //   "loading_screen"   -> transitioning between states
        //   "legend_selection" -> character select screen
        //   "aircraft"         -> in the drop ship (match has started)
        //   "freefly"          -> free-falling from drop ship
        //   "landed"           -> player has dropped into the map
        //   "match_summary"    -> match ended, showing results
        //
        // Legacy/alternative values also handled:
        //   "select"           -> character select (alias for legend_selection)
        //   "playing"          -> in-match (generic)
        //   "summary"          -> match ended (alias for match_summary)
        if (typeof value === 'string') {
          const newPhase = value.toLowerCase();

          // Emit the RAW phase string so external listeners (e.g., index.ts)
          // can react to specific GEP phases like "loading_screen" that get
          // mapped away by parseGamePhase.
          this.emit('raw-phase', newPhase);

          // Detect match start: aircraft/freefly/landed = in the match
          // "playing" and "match" kept for backward compatibility
          if ((newPhase === 'landed' || newPhase === 'aircraft' || newPhase === 'freefly' || newPhase === 'playing' || newPhase === 'match') && !this.inMatch) {
            console.log(`[EventProcessor] MATCH DETECTED: phase -> ${newPhase} (starting match)`);
            const startEvent: DomainEvent = {
              type: 'MATCH_START',
              timestamp: Date.now(),
              mode: this.resolveCurrentMode(),
            };
            this.applyToStats(startEvent);
            this.pendingBatch.push(startEvent);
            this.emit('domain-event', startEvent);
          }

          // Detect match end: "match_summary" or "lobby" (if was in match)
          if ((newPhase === 'match_summary' || newPhase === 'lobby' || newPhase === 'summary' || newPhase === 'post_match') && this.inMatch) {
            const matchStats = this.currentMatch;
            console.log(
              `[EventProcessor] MATCH ENDED: phase -> ${newPhase} (ending match, saving stats)`,
            );
            console.log(
              `[EventProcessor] Match stats: kills=${matchStats.kills}, assists=${matchStats.assists}, damage=${matchStats.damage}`,
            );
            const endEvent: DomainEvent = {
              type: 'MATCH_END',
              timestamp: Date.now(),
            };
            this.applyToStats(endEvent);
            this.pendingBatch.push(endEvent);
            this.emit('domain-event', endEvent);
          }

          // Also emit the GAME_PHASE event for any other listeners (UI, state machine)
          const phaseEvent = mapGepEvent('phase', JSON.stringify({ phase: value }), {
            matchStartTime: this.matchStartTime,
          });
          if (phaseEvent) {
            this.pendingBatch.push(phaseEvent);
            this.emit('domain-event', phaseEvent);
          }
        }
        break;
      }

      case 'weapons': {
        // Equipped weapons: { weapon0: "R-301 Carbine", weapon1: "Alternator SMG" }
        if (typeof value === 'object' && value !== null) {
          this.equippedWeapons = {};
          const weapons = value as Record<string, unknown>;
          for (const [slot, weaponName] of Object.entries(weapons)) {
            if (typeof weaponName === 'string' && weaponName.length > 0) {
              this.equippedWeapons[slot] = weaponName;
            }
          }
          this.emit('weapons-update', { ...this.equippedWeapons });
        }
        break;
      }

      case 'game_mode': {
        // Internal game mode identifier (e.g., "#PL_TITLE_UNHINGED")
        if (typeof value === 'string') {
          this.gameMode = value;
          this.emit('game-mode', { gameMode: this.gameMode, modeName: this.modeName });
        }
        break;
      }

      case 'mode_name': {
        // Human-readable mode name (e.g., "Wildcard")
        if (typeof value === 'string') {
          this.modeName = value;
          this.emit('game-mode', { gameMode: this.gameMode, modeName: this.modeName });
        }
        break;
      }

      case 'location': {
        // Player position: { x: "-132", y: "63", z: "28" }
        if (typeof value === 'object' && value !== null) {
          const loc = value as Record<string, unknown>;
          this.playerLocation = {
            x: parseFloat(String(loc.x ?? '0')),
            y: parseFloat(String(loc.y ?? '0')),
            z: parseFloat(String(loc.z ?? '0')),
          };
          this.emit('location-update', this.playerLocation);
        }
        break;
      }

      case 'legendName':
      case 'legend':
      case 'selected_legend':
      case 'legend_select':
      case 'character_name': {
        // Legend selected (may come via me feature with various key names)
        console.log(`[EventProcessor][LEGEND-DEBUG] Key "${key}" received with value: "${value}" (type: ${typeof value})`);
        if (typeof value === 'string' && value.length > 0) {
          const event: DomainEvent = {
            type: 'LEGEND_SELECTED',
            legend: cleanLegendName(value),
            timestamp: Date.now(),
          };
          this.pendingBatch.push(event);
          this.emit('domain-event', event);
        }
        break;
      }

      case 'me': {
        // The "me" feature bundles player info including legend name.
        // Shape: { name: "...", legendName: "Wraith", ... } or JSON string
        console.log(`[EventProcessor][LEGEND-DEBUG] "me" key received:`, JSON.stringify(value));
        if (typeof value === 'object' && value !== null) {
          const me = value as Record<string, unknown>;
          const legendFromMe = (me.legendName as string)
            ?? (me.legend as string)
            ?? (me.selected_legend as string)
            ?? (me.character_name as string);
          console.log(`[EventProcessor][LEGEND-DEBUG] "me" legend extraction: legendName=${me.legendName}, legend=${me.legend}, selected_legend=${me.selected_legend}, character_name=${me.character_name} -> "${legendFromMe}"`);
          if (legendFromMe && typeof legendFromMe === 'string' && legendFromMe.length > 0) {
            const event: DomainEvent = {
              type: 'LEGEND_SELECTED',
              legend: cleanLegendName(legendFromMe),
              timestamp: Date.now(),
            };
            this.pendingBatch.push(event);
            this.emit('domain-event', event);
          }
          // Also extract player name if present
          const nameFromMe = (me.name as string) ?? (me.player_name as string);
          if (nameFromMe && typeof nameFromMe === 'string' && nameFromMe.length > 0) {
            this.playerName = nameFromMe;
            this.emit('player-name', nameFromMe);
          }
        }
        break;
      }

      case 'match_state': {
        // match_state: "active" = match start, "inactive" = match end.
        // Redundant with phase transitions but provides a clean signal.
        if (typeof value === 'string') {
          const state = value.toLowerCase();
          if (state === 'active' && !this.inMatch) {
            console.log('[EventProcessor] MATCH DETECTED: match_state -> active');
            const startEvent: DomainEvent = {
              type: 'MATCH_START',
              timestamp: Date.now(),
              mode: this.resolveCurrentMode(),
            };
            this.applyToStats(startEvent);
            this.pendingBatch.push(startEvent);
            this.emit('domain-event', startEvent);
          } else if (state === 'inactive' && this.inMatch) {
            console.log('[EventProcessor] MATCH ENDED: match_state -> inactive');
            const endEvent: DomainEvent = {
              type: 'MATCH_END',
              timestamp: Date.now(),
            };
            this.applyToStats(endEvent);
            this.pendingBatch.push(endEvent);
            this.emit('domain-event', endEvent);
          }
        }
        break;
      }

      case 'match_summary': {
        // match_summary: { rank (1-20 placement), teams, squadKills }
        // Emitted when the post-match summary screen appears.
        if (typeof value === 'object' && value !== null) {
          const summary = value as Record<string, unknown>;
          const rank = this.safeInt(summary.rank);
          if (rank > 0) {
            const placementEvent: DomainEvent = {
              type: 'MATCH_PLACEMENT',
              position: rank,
              timestamp: Date.now(),
            };
            this.pendingBatch.push(placementEvent);
            this.emit('domain-event', placementEvent);
            console.log(`[EventProcessor] Match placement: #${rank}`);
          }
        }
        break;
      }

      case 'map_id':
      case 'map_name': {
        // Map info -- store for use in match persistence
        if (typeof value === 'string' && value.length > 0) {
          this.currentMapName = value;
          this.emit('map-update', value);
          console.log(`[EventProcessor] Map: ${value}`);
        }
        break;
      }

      case 'victory': {
        // victory: true/false for win/loss
        // When true, effectively means placement #1
        if (value === true || value === 'true') {
          const placementEvent: DomainEvent = {
            type: 'MATCH_PLACEMENT',
            position: 1,
            timestamp: Date.now(),
          };
          this.pendingBatch.push(placementEvent);
          this.emit('domain-event', placementEvent);
          console.log('[EventProcessor] VICTORY! Placement: #1');
        }
        break;
      }

      case 'totalDamageDealt': {
        // Real-time damage counter from the damage feature.
        // This is a running total of damage dealt in the current match,
        // sent as a separate key from the "damage" feature category.
        if (typeof value === 'number' || typeof value === 'string') {
          const dmg = typeof value === 'number' ? value : parseInt(String(value), 10);
          if (!isNaN(dmg) && this.inMatch) {
            this.currentMatch.damage = dmg;
            this.emit('live-stats', {
              kills: this.currentMatch.kills,
              assists: this.currentMatch.assists,
              damage: dmg,
              teams: 0,
              players: 0,
            });
          }
        }
        break;
      }

      default:
        // Handle legendSelect_0, legendSelect_1, legendSelect_2 from the "team" feature.
        // Shape: { playerName, legendName, selectionOrder, lead, is_local }
        // Only the entry with is_local=true is the local player's legend.
        if (key.startsWith('legendSelect_')) {
          // GEP sends legendSelect_X: null at match end to clear — skip it
          if (value === null || value === undefined) {
            console.log(`[EventProcessor] Ignoring null ${key} update (GEP post-match clear)`);
            break;
          }

          console.log(`[EventProcessor][LEGEND-DEBUG] ${key} raw value type=${typeof value}, value=${JSON.stringify(value)}`);

          // Format A (ow-native / documented): value is an object with legendName + is_local fields
          // { playerName, legendName: "#character_wraith_NAME", selectionOrder, lead, is_local }
          if (typeof value === 'object' && value !== null) {
            const sel = value as Record<string, unknown>;
            console.log(`[EventProcessor][LEGEND-DEBUG] ${key} object: is_local=${sel.is_local} (${typeof sel.is_local}), legendName=${sel.legendName}`);
            if (sel.is_local === true || sel.is_local === 'true' || sel.is_local === '1' || sel.is_local === 1) {
              const legendRaw = sel.legendName as string;
              if (legendRaw && typeof legendRaw === 'string' && legendRaw.length > 0) {
                const cleaned = cleanLegendName(legendRaw);
                console.log(`[EventProcessor][LEGEND-DEBUG] ${key} object match -> "${cleaned}"`);
                const event: DomainEvent = {
                  type: 'LEGEND_SELECTED',
                  legend: cleaned,
                  timestamp: Date.now(),
                };
                this.pendingBatch.push(event);
                this.emit('domain-event', event);
              }
            } else if (sel.is_local === false || sel.is_local === 'false' || sel.is_local === '0' || sel.is_local === 0) {
              // Not local player — skip
              console.log(`[EventProcessor][LEGEND-DEBUG] ${key} is not local player, skipping`);
            } else {
              // is_local missing or unexpected — ow-electron may not include it.
              // If there is only ONE legendSelect key (index 0) and no is_local,
              // assume it IS the local player (ow-electron simplified format).
              const legendRaw = (sel.legendName ?? sel.legend ?? sel.character_name) as string;
              if (legendRaw && typeof legendRaw === 'string' && legendRaw.length > 0 && key === 'legendSelect_0') {
                const cleaned = cleanLegendName(legendRaw);
                console.log(`[EventProcessor][LEGEND-DEBUG] ${key} no is_local, assuming local (legendSelect_0 fallback) -> "${cleaned}"`);
                const event: DomainEvent = {
                  type: 'LEGEND_SELECTED',
                  legend: cleaned,
                  timestamp: Date.now(),
                };
                this.pendingBatch.push(event);
                this.emit('domain-event', event);
              }
            }
          }

          // Format B (ow-electron simplified): value is a plain string (the legend name or localization key)
          // This handles the case where ow-electron sends "Wraith" or "#character_wraith_NAME" directly.
          // Only fire for legendSelect_0 since we can't know if it's the local player otherwise.
          else if (typeof value === 'string' && value.length > 0 && key === 'legendSelect_0') {
            const cleaned = cleanLegendName(value);
            console.log(`[EventProcessor][LEGEND-DEBUG] ${key} string format -> "${cleaned}"`);
            const event: DomainEvent = {
              type: 'LEGEND_SELECTED',
              legend: cleaned,
              timestamp: Date.now(),
            };
            this.pendingBatch.push(event);
            this.emit('domain-event', event);
          }
        }
        // Handle roster_0 through roster_59 from the "roster" feature.
        // Roster entries include the player's legend (character_name) and is_local flag.
        // This serves as a fallback for legend detection when the overlay starts
        // AFTER legend selection (legendSelect_X was missed).
        // Shape: { name, isTeammate, team_id, platform_hw, state, is_local, character_name }
        else if (key.startsWith('roster_')) {
          if (typeof value === 'object' && value !== null) {
            const roster = value as Record<string, unknown>;
            const isLocal = roster.is_local === true || roster.is_local === 'true'
              || roster.is_local === '1' || roster.is_local === 1;
            if (isLocal) {
              // DEBUG: Log all fields of the local player's roster entry
              console.log(`[EventProcessor][LEGEND-DEBUG] ${key} local player roster:`, JSON.stringify(roster));
              const legendRaw = (roster.character_name as string)
                ?? (roster.legendName as string)
                ?? (roster.legend as string);
              console.log(`[EventProcessor][LEGEND-DEBUG] ${key} legend extraction: character_name=${roster.character_name}, legendName=${roster.legendName}, legend=${roster.legend} -> legendRaw="${legendRaw}"`);
              if (legendRaw && typeof legendRaw === 'string' && legendRaw.length > 0) {
                const cleaned = cleanLegendName(legendRaw);
                console.log(`[EventProcessor][LEGEND-DEBUG] cleanLegendName("${legendRaw}") -> "${cleaned}"`);
                console.log(`[EventProcessor] Local legend from roster via ${key}: ${legendRaw} -> ${cleaned}`);
                const event: DomainEvent = {
                  type: 'LEGEND_SELECTED',
                  legend: cleaned,
                  timestamp: Date.now(),
                };
                this.pendingBatch.push(event);
                this.emit('domain-event', event);
              }
            }
          }
        } else {
          // Log unknown keys for debugging during development
          console.log(`[EventProcessor] Unhandled info key: "${key}" (feature: ${feature ?? 'unknown'})`);
        }
        break;
    }
  }

  /**
   * Resolve the current game mode from tracked mode_name / game_mode info.
   * Falls back to 'unknown' if no mode info has been received yet.
   */
  private resolveCurrentMode(): GameMode {
    const raw = this.modeName ?? this.gameMode;
    if (!raw) return 'unknown';
    const lower = raw.toLowerCase();
    if (lower.includes('ranked')) return 'ranked';
    if (lower.includes('arena')) return 'arenas';
    if (lower.includes('ltm') || lower.includes('limited')) return 'ltm';
    if (lower.includes('battle') || lower.includes('br') || lower.includes('trios') || lower.includes('duos')) {
      return 'battle_royale';
    }
    return 'unknown';
  }

  /**
   * Safely parse a value to integer, returning 0 for null/undefined/NaN.
   */
  private safeInt(val: unknown): number {
    if (val === null || val === undefined) return 0;
    const n = typeof val === 'number' ? val : parseInt(String(val), 10);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Get cumulative session stats (across all matches in this session).
   */
  getSessionStats(): SessionStats {
    return { ...this.session };
  }

  /**
   * Get stats for the current in-progress match only.
   */
  getCurrentMatchStats(): MatchStats {
    return { ...this.currentMatch };
  }

  /**
   * Get weapon kill data accumulated during the current match.
   * Returns an array of { weapon, kills, headshots, damage } entries.
   */
  getWeaponKills(): WeaponKillEntry[] {
    const entries: WeaponKillEntry[] = [];
    for (const [weapon, stats] of this.weaponKills) {
      entries.push({ weapon, kills: stats.kills, headshots: stats.headshots, damage: stats.damage });
    }
    return entries;
  }

  /**
   * Register a callback for batched event delivery.
   */
  onBatch(callback: BatchCallback): void {
    this.batchCallbacks.push(callback);
  }

  /**
   * Flush the pending event batch to all registered batch callbacks.
   */
  flushBatch(): void {
    if (this.pendingBatch.length === 0) return;

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];

    for (const cb of this.batchCallbacks) {
      cb(batch);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Update stats based on domain event type
  // -----------------------------------------------------------------------

  private applyToStats(event: DomainEvent): void {
    switch (event.type) {
      case 'MATCH_START':
        this.matchStartTime = event.timestamp;
        this.currentMatch = emptyMatchStats();
        this.weaponKills.clear();
        this.sessionAtMatchStart = { ...this.session };
        this.inMatch = true;
        // Clear cooldown since a legitimate match start has been detected
        this.lastMatchEndTime = 0;
        break;

      case 'MATCH_END':
        // Reconcile session stats with the authoritative match totals.
        // When ow-electron GEP tabs updates are active, currentMatch stats
        // reflect the game's cumulative totals (set directly from tabs),
        // which may differ from the sum of individual event increments.
        // We use the match totals as the source of truth and adjust session
        // stats to compensate for any missed individual events.
        this.reconcileSessionStats();
        this.session.matchesPlayed++;
        this.inMatch = false;
        this.matchStartTime = 0;
        this.lastMatchEndTime = Date.now();
        break;

      case 'PLAYER_KILL': {
        this.currentMatch.kills++;
        if (event.headshot) this.currentMatch.headshots++;
        // Also accumulate into live session total
        this.session.kills++;
        if (event.headshot) this.session.headshots++;

        // Accumulate weapon kill data for DB persistence at MATCH_END.
        // If the kill event didn't include weapon data (or it's 'Unknown'),
        // fall back to the currently equipped primary weapon from GEP info.
        let killWeapon = event.weapon;
        if (!killWeapon || killWeapon === 'Unknown') {
          killWeapon = this.equippedWeapons['weapon0']
            ?? this.equippedWeapons['0']
            ?? Object.values(this.equippedWeapons)[0]
            ?? 'Unknown';
        }
        if (killWeapon && killWeapon !== 'Unknown') {
          const existing = this.weaponKills.get(killWeapon) ?? { kills: 0, headshots: 0, damage: 0 };
          existing.kills++;
          if (event.headshot) existing.headshots++;
          this.weaponKills.set(killWeapon, existing);
        }
        break;
      }

      case 'PLAYER_DEATH':
        this.currentMatch.deaths++;
        this.session.deaths++;
        break;

      case 'PLAYER_ASSIST':
        this.currentMatch.assists++;
        this.session.assists++;
        break;

      case 'DAMAGE_DEALT':
        this.currentMatch.damage += event.amount;
        this.session.damage += event.amount;

        // Accumulate weapon damage for DB persistence at MATCH_END
        if (event.weapon && event.weapon !== 'Unknown') {
          const existing = this.weaponKills.get(event.weapon) ?? { kills: 0, headshots: 0, damage: 0 };
          existing.damage += event.amount;
          this.weaponKills.set(event.weapon, existing);
        }
        break;

      case 'PLAYER_KNOCKDOWN':
        this.currentMatch.knockdowns++;
        this.session.knockdowns++;
        break;

      case 'PLAYER_REVIVE':
        this.currentMatch.revives++;
        this.session.revives++;
        break;

      case 'PLAYER_RESPAWN':
        this.currentMatch.respawns++;
        this.session.respawns++;
        break;

      // LEGEND_SELECTED, RANK_UPDATE, MATCH_PLACEMENT, GAME_PHASE
      // do not affect numeric stat counters
      default:
        break;
    }
  }

  /**
   * Reconcile session stats with the authoritative match totals at match end.
   *
   * When ow-electron GEP tabs set currentMatch stats directly (e.g., kills=5),
   * the session stats may only have accumulated 3 kills from individual events.
   * This method uses: session_stat = sessionAtMatchStart + max(eventDelta, matchTotal)
   * to ensure the session totals are accurate.
   */
  private reconcileSessionStats(): void {
    const snap = this.sessionAtMatchStart;
    const match = this.currentMatch;

    // For each stat: compute how much was added via individual events,
    // then use whichever is higher -- the event-based delta or the tabs total.
    const keys: (keyof MatchStats)[] = [
      'kills', 'deaths', 'assists', 'damage', 'headshots',
      'knockdowns', 'revives', 'respawns',
    ];
    for (const key of keys) {
      const eventDelta = this.session[key] - snap[key];
      const matchTotal = match[key];
      // Use the larger of the two as the authoritative contribution
      this.session[key] = snap[key] + Math.max(eventDelta, matchTotal);
    }
  }
}
