// ============================================================
// Main Process Entry Point
// Initializes: windows, GEP, database, coaching engine, API
// Wires the domain event pipeline:
//   GEP -> EventProcessor -> DB repos -> coaching -> IPC broadcast
// ============================================================

import { app, BrowserWindow } from 'electron';

// GPU fallback for Linux/WSL where hardware GPU may not be available.
// Must be set before app.whenReady().
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
}

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
import { DailyAggregateRepository } from './db/repositories/daily-aggregate-repo';
import { WeaponKillRepository } from './db/repositories/weapon-kill-repo';
import { IPC } from '../shared/ipc-channels';
import { CoachingRepository } from './db/repositories/coaching-repo';
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
let matchResetTimer: ReturnType<typeof setTimeout> | null = null;

async function bootstrap(): Promise<void> {
  // 1. Initialize SQLite database and run migrations
  const db = initializeDatabase();

  // 2. Create coaching engine (rules now active)
  coachingEngine = new CoachingEngine(db);

  // 3. Create repositories
  const matchRepo = new MatchRepository(db);
  const sessionRepo = new SessionRepository(db);
  const legendStatsRepo = new LegendStatsRepository(db);
  const dailyAggregateRepo = new DailyAggregateRepository(db);
  const weaponKillRepo = new WeaponKillRepository(db);

  // 4. Create API client and scheduler
  const apiClient = new MozambiqueClient(db);
  apiScheduler = new ApiScheduler(apiClient, db);

  // 4a. Startup cleanup tasks -- prune stale data to prevent unbounded growth
  //     Wrapped in try-catch: these are non-critical and must not crash bootstrap
  //     if the DB tables haven't been fully set up yet.
  try {
    const coachingRepo = new CoachingRepository(db);
    coachingRepo.pruneOldDismissed(30);   // Clean up insights dismissed > 30 days ago
    apiClient.pruneOldProfiles(30);        // Clean up player profiles older than 30 days
  } catch (err) {
    console.warn('[apex-coach] Startup cleanup skipped:', err);
  }

  // 5. Register IPC handlers before windows open (renderer calls them immediately)
  registerIpcHandlers(db);

  // 6. Create overlay windows
  await createWindows();

  // 7. Initialize GEP via provider factory (CRITICAL FIX: was passing db, coachingEngine)
  const provider = createGEPProvider();
  gepManager = new GEPManager(provider);

  // 8. Wire the domain event pipeline (CRITICAL FIX: was not wired at all)
  gepManager.on('domain-event', (event: DomainEvent) => {
    handleDomainEvent(event, matchRepo, sessionRepo, legendStatsRepo, dailyAggregateRepo, weaponKillRepo);
  });

  // 8a. Wire ow-electron info update events to renderer IPC broadcasts.
  // These fire from EventProcessor when it receives key-value info updates
  // from the real ow-electron GEP (tabs, weapons, player name, etc.)
  const processor = gepManager.getProcessor();

  processor.on('live-stats', (stats: { kills: number; assists: number; damage: number; teams: number; players: number }) => {
    broadcastToAll(IPC.LIVE_STATS, stats);
    // Also broadcast as a MATCH_UPDATE so the existing match store picks it up
    broadcastToAll(IPC.MATCH_UPDATE, { type: 'live-stats', stats });
  });

  processor.on('weapons-update', (weapons: Record<string, string>) => {
    broadcastToAll(IPC.WEAPONS_UPDATE, weapons);
  });

  processor.on('player-name', (name: string) => {
    broadcastToAll(IPC.PLAYER_NAME, { name });
  });

  processor.on('game-mode', (mode: { gameMode: string | null; modeName: string | null }) => {
    broadcastToAll(IPC.GAME_MODE, mode);
  });

  processor.on('location-update', (location: { x: number; y: number; z: number }) => {
    broadcastToAll(IPC.PLAYER_LOCATION, location);
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
  dailyAggregateRepo: DailyAggregateRepository,
  weaponKillRepo: WeaponKillRepository,
): void {
  switch (event.type) {
    case 'MATCH_START': {
      // Clear any pending post-match reset timer from the previous match
      if (matchResetTimer !== null) {
        clearTimeout(matchResetTimer);
        matchResetTimer = null;
      }

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
        console.log('[apex-coach] MATCH_END - matchStats:', JSON.stringify(matchStats));
        console.log('[apex-coach] MATCH_END - currentLegend:', currentLegend, 'currentMap:', currentMap);
        let matchId: number | null = null;

        // Persist match data — wrapped in try/catch so a DB failure
        // doesn't kill coaching evaluation or UI updates
        try {
          matchId = matchRepo.create({
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

          // Persist weapon kills accumulated during the match
          const weaponKillEntries = gepManager.getProcessor().getWeaponKills();
          if (weaponKillEntries.length > 0) {
            weaponKillRepo.bulkCreate(
              weaponKillEntries.map((entry) => ({
                matchId: matchId!,
                sessionId: currentSessionId,
                weapon: entry.weapon,
                kills: entry.kills,
                headshots: entry.headshots,
                damage: entry.damage,
              })),
            );
          }

          // Update session aggregates
          sessionRepo.updateAggregates(currentSessionId);

          // Recalculate legend stats
          legendStatsRepo.recalculate(currentLegend);

          // Recalculate daily aggregates so session comparison coaching works
          dailyAggregateRepo.recalculateToday();
        } catch (err) {
          console.error('[apex-coach] Failed to persist match data:', err);
        }

        // Run coaching evaluation — even if DB write failed, we can
        // still evaluate from in-memory stats
        try {
          if (matchId !== null) {
            coachingEngine.evaluatePostMatch(matchId, currentSessionId);
          }
        } catch (err) {
          console.error('[apex-coach] Coaching evaluation failed:', err);
        }

        // Always broadcast to UI so the player sees their stats.
        // Include legend and map so the post-match window can display them.
        broadcastToAll(IPC.MATCH_END, {
          matchId,
          sessionId: currentSessionId,
          stats: matchStats,
          legend: currentLegend,
          map: currentMap,
          mode: currentMode,
          timestamp: event.timestamp,
        });

        // Show post-match overlay
        showWindow('post-match');
      }

      // Delay clearing per-match accumulators so the post-match window
      // has time to receive and render the data. The post-match summary
      // should remain visible until the next match starts.
      // Reset is deferred by 30 seconds, or cleared early on next MATCH_START.
      matchResetTimer = setTimeout(() => {
        matchStartedAt = null;
        currentMap = null;
        currentMode = 'unknown';
        matchResetTimer = null;
      }, 30_000);
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
app.whenReady().then(bootstrap).catch((err) => {
  console.error('[apex-coach] Fatal: bootstrap failed:', err);
  app.quit();
});

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
