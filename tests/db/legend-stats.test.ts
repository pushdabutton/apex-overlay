// ============================================================
// Legend Stats Accumulation -- Unit Tests
// Tests recalculate(), multi-legend independence, win rate,
// stats update on new matches.
// Uses real in-memory SQLite, no mocks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { LegendStatsRepository } from '../../src/main/db/repositories/legend-stats-repo';
import { MatchRepository } from '../../src/main/db/repositories/match-repo';
import type { Match } from '../../src/shared/types';

const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../../src/main/db/migrations/001-initial-schema.sql'),
  'utf-8',
);

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION_SQL);
  db.exec("INSERT INTO sessions (started_at) VALUES ('2026-04-26T10:00:00Z')");
  return db;
}

function sampleMatch(overrides: Partial<Omit<Match, 'id'>> = {}): Omit<Match, 'id'> {
  return {
    matchId: null,
    sessionId: 1,
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
    ...overrides,
  };
}

describe('Legend Stats Accumulation', () => {
  let db: Database.Database;
  let legendRepo: LegendStatsRepository;
  let matchRepo: MatchRepository;

  beforeEach(() => {
    db = createTestDb();
    legendRepo = new LegendStatsRepository(db);
    matchRepo = new MatchRepository(db);
  });

  it('should compute correct totals from all matches for a legend via recalculate()', () => {
    matchRepo.create(sampleMatch({ legend: 'Wraith', kills: 5, deaths: 1, damage: 1200, headshots: 2, placement: 3 }));
    matchRepo.create(sampleMatch({ legend: 'Wraith', kills: 8, deaths: 2, damage: 2000, headshots: 3, placement: 1, startedAt: '2026-04-26T12:30:00Z' }));

    legendRepo.recalculate('Wraith');

    const stats = legendRepo.findByLegend('Wraith');
    expect(stats).toBeDefined();
    expect(stats!.gamesPlayed).toBe(2);
    expect(stats!.totalKills).toBe(13);
    expect(stats!.totalDeaths).toBe(3);
    expect(stats!.totalDamage).toBe(3200);
    expect(stats!.totalHeadshots).toBe(5);
    expect(stats!.avgKills).toBe(6.5);
    expect(stats!.avgDamage).toBe(1600);
    expect(stats!.bestKills).toBe(8);
    expect(stats!.bestDamage).toBe(2000);
  });

  it('should update stats when new matches are added', () => {
    matchRepo.create(sampleMatch({ legend: 'Octane', kills: 3, damage: 800 }));
    legendRepo.recalculate('Octane');

    let stats = legendRepo.findByLegend('Octane')!;
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.totalKills).toBe(3);

    // Add another match
    matchRepo.create(sampleMatch({ legend: 'Octane', kills: 7, damage: 1500, startedAt: '2026-04-26T12:30:00Z' }));
    legendRepo.recalculate('Octane');

    stats = legendRepo.findByLegend('Octane')!;
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.totalKills).toBe(10);
    expect(stats.totalDamage).toBe(2300);
  });

  it('should track multiple legends independently', () => {
    matchRepo.create(sampleMatch({ legend: 'Wraith', kills: 10, damage: 2500 }));
    matchRepo.create(sampleMatch({ legend: 'Octane', kills: 3, damage: 700, startedAt: '2026-04-26T12:10:00Z' }));
    matchRepo.create(sampleMatch({ legend: 'Horizon', kills: 6, damage: 1400, startedAt: '2026-04-26T12:15:00Z' }));

    legendRepo.recalculate('Wraith');
    legendRepo.recalculate('Octane');
    legendRepo.recalculate('Horizon');

    const all = legendRepo.findAll();
    expect(all).toHaveLength(3);

    const wraith = legendRepo.findByLegend('Wraith')!;
    const octane = legendRepo.findByLegend('Octane')!;
    const horizon = legendRepo.findByLegend('Horizon')!;

    expect(wraith.totalKills).toBe(10);
    expect(octane.totalKills).toBe(3);
    expect(horizon.totalKills).toBe(6);
  });

  it('should calculate win rate correctly (wins / total games)', () => {
    // 3 matches: 2 wins (placement=1), 1 loss (placement=5)
    matchRepo.create(sampleMatch({ legend: 'Wraith', placement: 1 }));
    matchRepo.create(sampleMatch({ legend: 'Wraith', placement: 5, startedAt: '2026-04-26T12:10:00Z' }));
    matchRepo.create(sampleMatch({ legend: 'Wraith', placement: 1, startedAt: '2026-04-26T12:15:00Z' }));

    legendRepo.recalculate('Wraith');

    const stats = legendRepo.findByLegend('Wraith')!;
    expect(stats.totalWins).toBe(2);
    expect(stats.gamesPlayed).toBe(3);
    // Win rate = 2/3 ≈ 0.6667
    expect(stats.winRate).toBeCloseTo(2 / 3, 4);
  });
});
