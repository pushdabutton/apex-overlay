// ============================================================
// Shared Test Helper: Fixtures / Factories
// Canonical sample data factories used across all test suites.
// ============================================================

import type { Match } from '../../src/shared/types';

/**
 * Create a sample match input (without `id`).
 * Pass an explicit `sessionId` or override any field.
 */
export function sampleMatch(
  sessionIdOrOverrides?: number | Partial<Omit<Match, 'id'>>,
  overrides?: Partial<Omit<Match, 'id'>>,
): Omit<Match, 'id'> {
  // Handle two calling conventions:
  //   sampleMatch(1, { kills: 10 })  -- sessionId first
  //   sampleMatch({ kills: 10 })     -- just overrides (sessionId defaults to 1)
  let sessionId = 1;
  let mergedOverrides: Partial<Omit<Match, 'id'>> = {};

  if (typeof sessionIdOrOverrides === 'number') {
    sessionId = sessionIdOrOverrides;
    mergedOverrides = overrides ?? {};
  } else if (sessionIdOrOverrides != null) {
    mergedOverrides = sessionIdOrOverrides;
  }

  return {
    matchId: null,
    sessionId,
    legend: 'Wraith',
    map: 'Kings Canyon',
    mode: 'battle_royale',
    placement: 3,
    kills: 5,
    deaths: 1,
    assists: 2,
    damage: 1200,
    headshots: 2,
    shotsFired: 150,
    shotsHit: 45,
    knockdowns: 3,
    revives: 1,
    respawns: 0,
    survivalTime: 900,
    rpChange: 25,
    duration: 1200,
    startedAt: '2026-04-26T12:05:00Z',
    endedAt: '2026-04-26T12:25:00Z',
    ...mergedOverrides,
  };
}
