// ============================================================
// Main Process Entry Point
// Initializes: windows, GEP, database, coaching engine, API
// Wires the domain event pipeline:
//   GEP -> EventProcessor -> DB repos -> coaching -> IPC broadcast
// ============================================================

import { app, BrowserWindow } from 'electron';
import { createWindows, broadcastToAll, showWindow } from './windows';
import { registerIpcHandlers } from './ipc-handlers';
import { GEPManager } from './gep/gep-manager';
import { createGEPProvider } from './gep/gep-provider-factory';
import { initializeDatabase } from './db/database';
import { CoachingEngine } from './coaching/engine';
import { MozambiqueClient } from './api/mozambique-client';
import { ApiScheduler } from './api/api-scheduler';
import { MatchRepository } from './db/repositories/match-repo';
import { SessionRepository } from './db/repositories/session-repo';
import { LegendStatsRepository } from './db/repositories/legend-stats-repo';
import { IPC } from '../shared/ipc-channels';
import type { DomainEvent, Match } from '../shared/types';
import { nowISO } from '../shared/utils';

let gepManager: GEPManager;
let coachingEngine: CoachingEngine;
let apiScheduler: ApiScheduler;

// --- Live match accumulator (populated from domain events, flushed on MATCH_END) ---
let currentSessionId: number | null = null;
let currentLegend = 'Unknown';
let currentMap: string | null = null;
let currentMode: Match['mode'] = 'unknown';
let matchStartedAt: string | null = null;

async function bootstrap(): Promise<void> {
  // 1. Initialize SQLite database and run migrations
  const db = initializeDatabase();

  // 2. Create coaching engine (rules now active)
  coachingEngine = new CoachingEngine(db);

  // 3. Create repositories
  const matchRepo = new MatchRepository(db);
  const sessionRepo = new SessionRepository(db);
  const legendStatsRepo = new LegendStatsRepository(db);

  // 4. Create API client and scheduler
  const apiClient = new MozambiqueClient(db);
  apiScheduler = new ApiScheduler(apiClient, db);

  // 5. Create overlay windows
  await createWindows();

  // 6. Register IPC handlers (renderer <-> main communication)
  registerIpcHandlers(db, coachingEngine);

  // 7. Initialize GEP via provider factory (CRITICAL FIX: was passing db, coachingEngine)
  const provider = createGEPProvider();
  gepManager = new GEPManager(provider);

  // 8. Wire the domain event pipeline (CRITICAL FIX: was not wired at all)
  gepManager.on('domain-event', (event: DomainEvent) => {
    handleDomainEvent(event, matchRepo, sessionRepo, legendStatsRepo);
  });

  await gepManager.initialize();

  // 9. Start API polling
  await apiScheduler.start();
}

/**
 * Central domain event handler — routes events to DB, coaching, and UI.
 */
function handleDomainEvent(
  event: DomainEvent,
  matchRepo: MatchRepository,
  sessionRepo: SessionRepository,
  legendStatsRepo: LegendStatsRepository,
): void {
  switch (event.type) {
    case 'MATCH_START': {
      // Ensure a session exists
      if (currentSessionId === null) {
        currentSessionId = sessionRepo.create();
        coachingEngine.resetSession();
      }
      currentMode = event.mode;
      matchStartedAt = nowISO();

      broadcastToAll(IPC.MATCH_START, {
        sessionId: currentSessionId,
        mode: event.mode,
        timestamp: event.timestamp,
      });
      break;
    }

    case 'MATCH_END': {
      if (currentSessionId !== null && matchStartedAt) {
        const matchStats = gepManager.getProcessor().getCurrentMatchStats();
        const matchId = matchRepo.create({
          matchId: null,
          sessionId: currentSessionId,
          legend: currentLegend,
          map: currentMap,
          mode: currentMode,
          placement: null,
          kills: matchStats.kills,
          deaths: matchStats.deaths,
          assists: matchStats.assists,
          damage: matchStats.damage,
          headshots: matchStats.headshots,
          shotsFired: 0,
          shotsHit: 0,
          knockdowns: matchStats.knockdowns,
          revives: matchStats.revives,
          respawns: matchStats.respawns,
          survivalTime: 0,
          rpChange: null,
          duration: 0,
          startedAt: matchStartedAt,
          endedAt: nowISO(),
        });

        // Update session aggregates
        sessionRepo.updateAggregates(currentSessionId);

        // Recalculate legend stats
        legendStatsRepo.recalculate(currentLegend);

        // Run coaching evaluation
        coachingEngine.evaluatePostMatch(matchId, currentSessionId);

        // Broadcast match end to renderer
        broadcastToAll(IPC.MATCH_END, {
          matchId,
          sessionId: currentSessionId,
          stats: matchStats,
          timestamp: event.timestamp,
        });

        // Show post-match overlay
        showWindow('post-match');
      }

      // Reset per-match accumulators
      matchStartedAt = null;
      currentMap = null;
      currentMode = 'unknown';
      break;
    }

    case 'LEGEND_SELECTED':
      currentLegend = event.legend;
      broadcastToAll(IPC.MATCH_UPDATE, { type: 'legend', legend: event.legend });
      break;

    case 'GAME_PHASE':
      broadcastToAll(IPC.GAME_PHASE, { phase: event.phase, timestamp: event.timestamp });
      break;

    case 'MATCH_PLACEMENT':
      broadcastToAll(IPC.MATCH_UPDATE, { type: 'placement', position: event.position });
      break;

    // All live combat events -> broadcast to overlay
    case 'PLAYER_KILL':
    case 'PLAYER_DEATH':
    case 'PLAYER_ASSIST':
    case 'DAMAGE_DEALT':
    case 'PLAYER_KNOCKDOWN':
    case 'PLAYER_REVIVE':
    case 'PLAYER_RESPAWN': {
      const liveStats = gepManager.getProcessor().getCurrentMatchStats();
      broadcastToAll(IPC.MATCH_UPDATE, {
        type: 'stats',
        stats: liveStats,
        lastEvent: event.type,
        timestamp: event.timestamp,
      });
      break;
    }

    case 'RANK_UPDATE':
      broadcastToAll(IPC.MATCH_UPDATE, {
        type: 'rank',
        rankName: event.rankName,
        rankScore: event.rankScore,
      });
      break;
  }
}

// App lifecycle
app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  gepManager?.destroy();
  apiScheduler?.stop();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});
