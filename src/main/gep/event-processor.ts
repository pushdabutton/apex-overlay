// ============================================================
// Event Processor -- Converts raw GEP events to typed domain
// events, tracks session/match stats, supports event batching.
//
// This is a PURE processing layer with no DB or coaching
// dependencies. The GEP Manager wires it to those systems.
// ============================================================

import { EventEmitter } from 'events';
import { mapGepEvent } from './event-map';
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

export class EventProcessor extends EventEmitter {
  private matchStartTime = 0;
  private currentMatch: MatchStats = emptyMatchStats();
  private session: SessionStats = emptySessionStats();
  private inMatch = false;
  private pendingBatch: DomainEvent[] = [];
  private batchCallbacks: BatchCallback[] = [];

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
        legend: legendName,
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
   *   - "tabs"       -> live match stats { kills, assists, teams, players, damage }
   *   - "name"       -> player name (string)
   *   - "phase"      -> game phase: "lobby" | "select" | "playing" | "summary"
   *   - "weapons"    -> equipped weapons { weapon0, weapon1 }
   *   - "game_mode"  -> internal game mode string (e.g., "#PL_TITLE_UNHINGED")
   *   - "mode_name"  -> human-readable mode name (e.g., "Wildcard")
   *   - "location"   -> player position { x, y, z }
   *   - "player"     -> player info { player_name, in_game_player_name }
   *   - "legendName" -> selected legend name
   */
  private processKeyValueUpdate(key: string, value: unknown, feature?: string): void {
    switch (key) {
      case 'tabs': {
        // Live match stats from match_info feature
        // value: { kills, assists, teams, players, damage, cash }
        const tabs = typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)
          : {};
        const kills = this.safeInt(tabs.kills);
        const assists = this.safeInt(tabs.assists);
        const damage = this.safeInt(tabs.damage);
        const teams = this.safeInt(tabs.teams);
        const players = this.safeInt(tabs.players);

        // Emit a live stats update event so the UI can react
        this.emit('live-stats', { kills, assists, damage, teams, players });

        // Update current match stats from the authoritative game data.
        // GEP tabs gives us cumulative totals for the current match,
        // so we set them directly rather than incrementing.
        if (this.inMatch) {
          this.currentMatch.kills = kills;
          this.currentMatch.assists = assists;
          this.currentMatch.damage = damage;
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
        // match_start / match_end game events. Instead it sends phase updates:
        //   "lobby" | "select" | "playing" | "summary"
        if (typeof value === 'string') {
          const newPhase = value.toLowerCase();

          // Detect match start: transitioning TO "playing" from any non-playing state
          if ((newPhase === 'playing' || newPhase === 'match') && !this.inMatch) {
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

          // Detect match end: transitioning FROM "playing" to "lobby" or "summary"
          if ((newPhase === 'lobby' || newPhase === 'summary' || newPhase === 'post_match') && this.inMatch) {
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
      case 'legend': {
        // Legend selected (may come via me feature)
        if (typeof value === 'string' && value.length > 0) {
          const event: DomainEvent = {
            type: 'LEGEND_SELECTED',
            legend: value,
            timestamp: Date.now(),
          };
          this.pendingBatch.push(event);
          this.emit('domain-event', event);
        }
        break;
      }

      default:
        // Log unknown keys for debugging during development
        console.log(`[EventProcessor] Unhandled info key: "${key}" (feature: ${feature ?? 'unknown'})`);
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
        break;

      case 'PLAYER_KILL': {
        this.currentMatch.kills++;
        if (event.headshot) this.currentMatch.headshots++;
        // Also accumulate into live session total
        this.session.kills++;
        if (event.headshot) this.session.headshots++;

        // Accumulate weapon kill data for DB persistence at MATCH_END
        if (event.weapon) {
          const existing = this.weaponKills.get(event.weapon) ?? { kills: 0, headshots: 0, damage: 0 };
          existing.kills++;
          if (event.headshot) existing.headshots++;
          this.weaponKills.set(event.weapon, existing);
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
