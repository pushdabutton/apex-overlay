// ============================================================
// Match Persistence End-to-End -- Unit Tests
// Tests create, query by session/legend/recent, stats round-trip.
// Uses real in-memory SQLite, no mocks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
  // Insert a session for foreign key satisfaction
  db.exec("INSERT INTO sessions (started_at) VALUES ('2026-04-26T10:00:00Z')");
  db.exec("INSERT INTO sessions (started_at) VALUES ('2026-04-26T14:00:00Z')");
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

describe('Match Persistence E2E', () => {
  let db: Database.Database;
  let repo: MatchRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new MatchRepository(db);
  });

  it('should create a match and return an ID, then the match is queryable', () => {
    const id = repo.create(sampleMatch());
    expect(id).toBeGreaterThan(0);

    const match = repo.findById(id);
    expect(match).toBeDefined();
    expect(match!.legend).toBe('Wraith');
    expect(match!.damage).toBe(1200);
    expect(match!.id).toBe(id);
  });

  it('should find matches by session ID', () => {
    repo.create(sampleMatch({ sessionId: 1 }));
    repo.create(sampleMatch({ sessionId: 1, legend: 'Octane', startedAt: '2026-04-26T12:30:00Z' }));
    repo.create(sampleMatch({ sessionId: 2, legend: 'Horizon', startedAt: '2026-04-26T14:05:00Z' }));

    const session1 = repo.findBySessionId(1);
    const session2 = repo.findBySessionId(2);

    expect(session1).toHaveLength(2);
    expect(session2).toHaveLength(1);
    expect(session2[0].legend).toBe('Horizon');
  });

  it('should find recent matches in newest-first order', () => {
    repo.create(sampleMatch({ startedAt: '2026-04-26T10:00:00Z', legend: 'Oldest' }));
    repo.create(sampleMatch({ startedAt: '2026-04-26T11:00:00Z', legend: 'Middle' }));
    repo.create(sampleMatch({ startedAt: '2026-04-26T12:00:00Z', legend: 'Newest' }));

    const recent = repo.findRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].legend).toBe('Newest');
    expect(recent[1].legend).toBe('Middle');
  });

  it('should find matches by legend and filter correctly', () => {
    repo.create(sampleMatch({ legend: 'Wraith' }));
    repo.create(sampleMatch({ legend: 'Octane', startedAt: '2026-04-26T12:10:00Z' }));
    repo.create(sampleMatch({ legend: 'Wraith', startedAt: '2026-04-26T12:15:00Z' }));

    const wraiths = repo.findByLegend('Wraith');
    expect(wraiths).toHaveLength(2);
    expect(wraiths.every((m) => m.legend === 'Wraith')).toBe(true);

    const octanes = repo.findByLegend('Octane');
    expect(octanes).toHaveLength(1);
  });

  it('should round-trip match stats correctly through create and read', () => {
    const input = sampleMatch({
      kills: 12,
      deaths: 3,
      assists: 7,
      damage: 3456,
      headshots: 5,
      shotsFired: 300,
      shotsHit: 120,
      knockdowns: 8,
      revives: 2,
      respawns: 1,
      survivalTime: 1500,
      rpChange: 75,
      duration: 1800,
      placement: 1,
    });

    const id = repo.create(input);
    const match = repo.findById(id)!;

    expect(match.kills).toBe(12);
    expect(match.deaths).toBe(3);
    expect(match.assists).toBe(7);
    expect(match.damage).toBe(3456);
    expect(match.headshots).toBe(5);
    expect(match.shotsFired).toBe(300);
    expect(match.shotsHit).toBe(120);
    expect(match.knockdowns).toBe(8);
    expect(match.revives).toBe(2);
    expect(match.respawns).toBe(1);
    expect(match.survivalTime).toBe(1500);
    expect(match.rpChange).toBe(75);
    expect(match.duration).toBe(1800);
    expect(match.placement).toBe(1);
  });
});
