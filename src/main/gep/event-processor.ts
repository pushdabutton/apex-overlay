// ============================================================
// Event Processor -- Receives raw GEP events, enriches with
// context, dispatches to DB, coaching engine, and UI
// ============================================================

import { EventEmitter } from 'events';
import type Database from 'better-sqlite3';
import { mapGepEvent } from './event-map';
import { CoachingEngine } from '../coaching/engine';
import { broadcastToAll } from '../windows';
import { IPC } from '../../shared/ipc-channels';
import type { DomainEvent, LiveMatchState, GameMode } from '../../shared/types';
import { nowISO } from '../../shared/utils';

interface GepEventPayload {
  events: Array<{ name: string; data: string }>;
}

interface GepInfoPayload {
  info: Record<string, unknown>;
}

export class EventProcessor extends EventEmitter {
  private db: Database.Database;
  private coaching: CoachingEngine;

  // Current match state (in-memory, persisted at match end)
  private liveMatch: LiveMatchState | null = null;
  private matchStartTime = 0;
  private currentSessionId: number | null = null;

  constructor(db: Database.Database, coaching: CoachingEngine) {
    super();
    this.db = db;
    this.coaching = coaching;
  }

  /**
   * Process a batch of raw GEP events.
   */
  processEvent(payload: GepEventPayload): void {
    for (const rawEvent of payload.events) {
      const domainEvent = mapGepEvent(rawEvent.name, rawEvent.data, {
        matchStartTime: this.matchStartTime,
      });

      if (domainEvent) {
        this.handleDomainEvent(domainEvent);
      }
    }
  }

  /**
   * Process GEP info updates (some data arrives as info, not events).
   */
  processInfoUpdate(payload: GepInfoPayload): void {
    // Info updates often contain legend selection, match mode, etc.
    // Process based on info keys present
    const info = payload.info;

    if (info.legendName && typeof info.legendName === 'string') {
      this.handleDomainEvent({
        type: 'LEGEND_SELECTED',
        legend: info.legendName,
        timestamp: Date.now(),
      });
    }
  }

  private handleDomainEvent(event: DomainEvent): void {
    switch (event.type) {
      case 'MATCH_START':
        this.onMatchStart(event.mode);
        break;

      case 'MATCH_END':
        this.onMatchEnd();
        break;

      case 'PLAYER_KILL':
        if (this.liveMatch) {
          this.liveMatch.kills++;
          if (event.headshot) this.liveMatch.headshots++;
          this.broadcastMatchUpdate();
        }
        break;

      case 'PLAYER_DEATH':
        if (this.liveMatch) {
          this.liveMatch.deaths++;
          this.broadcastMatchUpdate();
        }
        break;

      case 'PLAYER_ASSIST':
        if (this.liveMatch) {
          this.liveMatch.assists++;
          this.broadcastMatchUpdate();
        }
        break;

      case 'DAMAGE_DEALT':
        if (this.liveMatch) {
          this.liveMatch.damage += event.amount;
          this.liveMatch.shotsFired++;
          this.liveMatch.shotsHit++;
          this.broadcastMatchUpdate();
        }
        break;

      case 'PLAYER_KNOCKDOWN':
        if (this.liveMatch) {
          this.liveMatch.knockdowns++;
          this.broadcastMatchUpdate();
        }
        break;

      case 'PLAYER_REVIVE':
        if (this.liveMatch) {
          this.liveMatch.revives++;
        }
        break;

      case 'PLAYER_RESPAWN':
        if (this.liveMatch) {
          this.liveMatch.respawns++;
        }
        break;

      case 'LEGEND_SELECTED':
        if (this.liveMatch) {
          this.liveMatch.legend = event.legend;
        }
        break;

      case 'MATCH_PLACEMENT':
        // Placement often arrives just before or with match_end
        if (this.liveMatch) {
          // Store for use in onMatchEnd
          (this.liveMatch as unknown as Record<string, number>)._placement = event.position;
        }
        break;

      case 'RANK_UPDATE':
        broadcastToAll(IPC.MATCH_UPDATE, {
          rankName: event.rankName,
          rankScore: event.rankScore,
        });
        break;

      case 'GAME_PHASE':
        broadcastToAll(IPC.GAME_PHASE, { phase: event.phase });
        break;
    }

    // Emit for any other listeners
    this.emit('domain-event', event);
  }

  private onMatchStart(mode: GameMode): void {
    // Ensure we have an active session
    if (!this.currentSessionId) {
      this.currentSessionId = this.createSession();
    }

    this.matchStartTime = Date.now();
    this.liveMatch = {
      matchId: null,
      sessionId: this.currentSessionId,
      legend: 'Unknown',
      map: null,
      mode,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      knockdowns: 0,
      revives: 0,
      respawns: 0,
      startedAt: Date.now(),
      phase: 'playing',
    };

    broadcastToAll(IPC.MATCH_START, { mode });
  }

  private onMatchEnd(): void {
    if (!this.liveMatch) return;

    const duration = Math.floor((Date.now() - this.liveMatch.startedAt) / 1000);
    const placement = (this.liveMatch as unknown as Record<string, number>)._placement ?? null;

    // Persist match to database
    const stmt = this.db.prepare(`
      INSERT INTO matches (
        session_id, legend, map, mode, placement,
        kills, deaths, assists, damage, headshots,
        shots_fired, shots_hit, knockdowns, revives, respawns,
        survival_time, duration, started_at, ended_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      this.liveMatch.sessionId,
      this.liveMatch.legend,
      this.liveMatch.map,
      this.liveMatch.mode,
      placement,
      this.liveMatch.kills,
      this.liveMatch.deaths,
      this.liveMatch.assists,
      this.liveMatch.damage,
      this.liveMatch.headshots,
      this.liveMatch.shotsFired,
      this.liveMatch.shotsHit,
      this.liveMatch.knockdowns,
      this.liveMatch.revives,
      this.liveMatch.respawns,
      duration,
      duration,
      new Date(this.liveMatch.startedAt).toISOString(),
      nowISO(),
    );

    const matchId = Number(result.lastInsertRowid);

    // Update session aggregates
    this.updateSessionAggregates(matchId);

    // Update legend stats
    this.updateLegendStats(this.liveMatch.legend, matchId);

    // Run coaching engine post-match analysis
    this.coaching.evaluatePostMatch(matchId, this.liveMatch.sessionId);

    // Broadcast match end to UI
    broadcastToAll(IPC.MATCH_END, { matchId });

    // Reset live match
    this.liveMatch = null;
    this.matchStartTime = 0;
  }

  private broadcastMatchUpdate(): void {
    if (!this.liveMatch) return;
    broadcastToAll(IPC.MATCH_UPDATE, { ...this.liveMatch });
  }

  private createSession(): number {
    const stmt = this.db.prepare(
      'INSERT INTO sessions (started_at) VALUES (?)'
    );
    const result = stmt.run(nowISO());
    return Number(result.lastInsertRowid);
  }

  private updateSessionAggregates(_matchId: number): void {
    // TODO: Implement session aggregate recalculation
    // Query all matches for this session, compute totals, update sessions row
  }

  private updateLegendStats(_legend: string, _matchId: number): void {
    // TODO: Implement legend stats recalculation
    // Upsert legend_stats row with updated aggregates
  }
}
