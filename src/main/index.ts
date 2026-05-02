// ============================================================
// Main Process Entry Point
// Initializes: windows, GEP, database, coaching engine, API
// Wires the domain event pipeline:
//   GEP -> EventProcessor -> DB repos -> coaching -> IPC broadcast
// ============================================================

import { app, BrowserWindow } from 'electron';
import { config as loadEnv } from 'dotenv';

// Load .env from project root (API keys, etc.)
loadEnv();

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
    // Trigger API profile fetch using the GEP-detected player name.
    // This is the primary mechanism for getting rank data -- the
    // settings DB api.playerName is rarely populated manually, but
    // GEP always provides the player name.
    apiScheduler.refreshPlayerProfile(name);
  });

  processor.on('game-mode', (mode: { gameMode: string | null; modeName: string | null }) => {
    broadcastToAll(IPC.GAME_MODE, mode);
  });

  processor.on('location-update', (location: { x: number; y: number; z: number }) => {
    broadcastToAll(IPC.PLAYER_LOCATION, location);
  });

  processor.on('map-update', (mapName: string) => {
    currentMap = mapName;
  });

  // LEGEND-HUNT: Call getInfo() when loading_screen fires.
  // Legend selection happens BETWEEN lobby and loading_screen.
  // If legendSelect_X didn't fire as a live event, getInfo() may still
  // have the data available as a retroactive snapshot.
  //
  // If legend is STILL unknown after getInfo(), fall back to the
  // mozambiquehe.re API which exposes selectedLegend in realtime data.
  processor.on('raw-phase', (rawPhase: string) => {
    if (rawPhase === 'loading_screen') {
      gepManager.getInfo().then(async (snapshot) => {
        console.log('[LEGEND-HUNT] getInfo() on loading_screen - FULL snapshot:', JSON.stringify(snapshot));

        // If legend is still Unknown after getInfo() processing, try API fallback
        if (currentLegend === 'Unknown') {
          const playerName = processor.getPlayerName();
          if (playerName && apiClient.isConfigured()) {
            console.log(`[LEGEND-HUNT] Legend still Unknown, trying mozambique API for player: ${playerName}`);
            try {
              const apiLegend = await apiClient.getSelectedLegend(playerName);
              if (apiLegend && currentLegend === 'Unknown') {
                console.log(`[LEGEND-HUNT] mozambique API selectedLegend: "${apiLegend}"`);
                currentLegend = apiLegend;
                broadcastToAll(IPC.MATCH_UPDATE, { type: 'legend', legend: apiLegend });
              }
            } catch (err) {
              console.warn('[LEGEND-HUNT] mozambique API fallback failed:', err);
            }
          } else {
            console.log(`[LEGEND-HUNT] Cannot try API fallback: playerName=${playerName}, apiConfigured=${apiClient.isConfigured()}`);
          }
        }
      }).catch((err) => {
        console.warn('[LEGEND-HUNT] getInfo() on loading_screen failed:', err);
      });
    }
  });

  await gepManager.initialize();

  // 8b. Wire API player profile to rank update pipeline.
  // GEP's "rank" feature only sends "victory" (true/false) -- it does NOT
  // send rank name or score as info updates. The only source of rank data
  // is the mozambiquehe.re API player profile. When a profile arrives,
  // extract rank data and broadcast as a MATCH_UPDATE with type: 'rank'
  // so the RankedProgress component can display it.
  apiScheduler.onPlayerProfile((profile) => {
    if (profile.rankName && profile.rankName !== 'Unknown') {
      console.log(`[apex-coach] API rank data: ${profile.rankName} (${profile.rankScore} RP)`);
      broadcastToAll(IPC.MATCH_UPDATE, {
        type: 'rank',
        rankName: profile.rankName,
        rankScore: profile.rankScore,
      });
    }
  });

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
      console.log('[apex-coach] MATCH_START detected! Mode:', event.mode);

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
      // Grab match stats FIRST, before any resets — this is the data the player needs
      const matchStats = gepManager.getProcessor().getCurrentMatchStats();
      console.log('[apex-coach] MATCH_END - matchStats:', JSON.stringify(matchStats));
      console.log('[apex-coach] MATCH_END - currentLegend:', currentLegend, 'currentMap:', currentMap);
      console.log('[apex-coach] MATCH_END - sessionId:', currentSessionId, 'matchStartedAt:', matchStartedAt);

      let matchId: number | null = null;

      // ALWAYS broadcast to UI so the player sees their stats,
      // regardless of session state.  The previous code gated the
      // broadcast on (currentSessionId && matchStartedAt), which
      // caused all-zero stats when MATCH_START hadn't created a session.
      broadcastToAll(IPC.MATCH_END, {
        matchId: null, // will be updated below if persisted
        sessionId: currentSessionId,
        stats: matchStats,
        legend: currentLegend,
        map: currentMap,
        mode: currentMode,
        timestamp: event.timestamp,
      });

      // Broadcast cumulative session stats so all renderer windows
      // (including post-match, which is a separate BrowserWindow with
      // its own store) can display session averages and comparisons.
      const sessionStats = gepManager.getProcessor().getSessionStats();
      broadcastToAll(IPC.SESSION_UPDATE, {
        totalKills: sessionStats.kills,
        totalDeaths: sessionStats.deaths,
        totalAssists: sessionStats.assists,
        totalDamage: sessionStats.damage,
        totalHeadshots: sessionStats.headshots,
        totalKnockdowns: sessionStats.knockdowns,
        matchesPlayed: sessionStats.matchesPlayed,
      });

      // Show post-match overlay (always — player should see their screen)
      showWindow('post-match');

      // Persist to DB and run coaching IF we have a session
      if (currentSessionId !== null && matchStartedAt) {
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
