// ============================================================
// Event Processor -- Converts raw GEP events to typed domain
// events, tracks session/match stats, supports event batching.
//
// This is a PURE processing layer with no DB or coaching
// dependencies. The GEP Manager wires it to those systems.
// ============================================================

import { EventEmitter } from 'events';
import { mapGepEvent } from './event-map';
import type { DomainEvent } from '../../shared/types';

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

  /**
   * Process GEP info updates (some data arrives as info, not events).
   */
  processInfoUpdate(payload: { info: Record<string, unknown> }): void {
    const info = payload.info;

    if (info.legendName && typeof info.legendName === 'string') {
      const event: DomainEvent = {
        type: 'LEGEND_SELECTED',
        legend: info.legendName,
        timestamp: Date.now(),
      };
      this.pendingBatch.push(event);
      this.emit('domain-event', event);
    }

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
        this.inMatch = true;
        break;

      case 'MATCH_END':
        // Session stats were already accumulated in real-time during the match.
        // Just increment match counter and reset per-match state.
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
}
