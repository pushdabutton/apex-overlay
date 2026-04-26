// ============================================================
// Match Repository -- Unit Tests
// Tests create(), row mapping (snake_case -> camelCase), and
// query methods against an in-memory SQLite database.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { MatchRepository, mapMatchRow } from '../../src/main/db/repositories/match-repo';
import type { Match } from '../../src/shared/types';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create minimal schema needed for match-repo tests
  db.exec(`
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    INSERT INTO sessions (started_at) VALUES ('2026-04-26T12:00:00Z');

    CREATE TABLE matches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id        TEXT UNIQUE,
      session_id      INTEGER NOT NULL,
      legend          TEXT NOT NULL,
      map             TEXT,
      mode            TEXT DEFAULT 'unknown',
      placement       INTEGER,
      kills           INTEGER DEFAULT 0,
      deaths          INTEGER DEFAULT 0,
      assists         INTEGER DEFAULT 0,
      damage          INTEGER DEFAULT 0,
      headshots       INTEGER DEFAULT 0,
      shots_fired     INTEGER DEFAULT 0,
      shots_hit       INTEGER DEFAULT 0,
      knockdowns      INTEGER DEFAULT 0,
      revives         INTEGER DEFAULT 0,
      respawns        INTEGER DEFAULT 0,
      survival_time   INTEGER DEFAULT 0,
      rp_change       INTEGER,
      duration        INTEGER DEFAULT 0,
      started_at      TEXT NOT NULL,
      ended_at        TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  return db;
}

function sampleMatch(): Omit<Match, 'id'> {
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
  };
}

describe('mapMatchRow', () => {
  it('should convert snake_case DB row to camelCase Match', () => {
    const row = {
      id: 1,
      match_id: 'abc123',
      session_id: 42,
      legend: 'Octane',
      map: "World's Edge",
      mode: 'ranked',
      placement: 1,
      kills: 8,
      deaths: 0,
      assists: 4,
      damage: 2500,
      headshots: 3,
      shots_fired: 200,
      shots_hit: 80,
      knockdowns: 5,
      revives: 2,
      respawns: 1,
      survival_time: 1200,
      rp_change: 150,
      duration: 1500,
      started_at: '2026-04-26T10:00:00Z',
      ended_at: '2026-04-26T10:25:00Z',
    };

    const match = mapMatchRow(row);

    expect(match.id).toBe(1);
    expect(match.matchId).toBe('abc123');
    expect(match.sessionId).toBe(42);
    expect(match.legend).toBe('Octane');
    expect(match.shotsFired).toBe(200);
    expect(match.shotsHit).toBe(80);
    expect(match.survivalTime).toBe(1200);
    expect(match.rpChange).toBe(150);
    expect(match.startedAt).toBe('2026-04-26T10:00:00Z');
    expect(match.endedAt).toBe('2026-04-26T10:25:00Z');
  });

  it('should handle null/missing fields with safe defaults', () => {
    const row = {
      id: 1,
      session_id: 1,
      legend: 'Bloodhound',
      started_at: '2026-04-26T10:00:00Z',
      // everything else is undefined/null
    };

    const match = mapMatchRow(row);

    expect(match.matchId).toBeNull();
    expect(match.map).toBeNull();
    expect(match.mode).toBe('unknown');
    expect(match.placement).toBeNull();
    expect(match.kills).toBe(0);
    expect(match.shotsFired).toBe(0);
    expect(match.rpChange).toBeNull();
    expect(match.endedAt).toBeNull();
  });
});

describe('MatchRepository', () => {
  let db: Database.Database;
  let repo: MatchRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new MatchRepository(db);
  });

  it('should insert and retrieve a match by id with correct camelCase mapping', () => {
    const input = sampleMatch();
    const id = repo.create(input);

    expect(id).toBeGreaterThan(0);

    const match = repo.findById(id);
    expect(match).toBeDefined();
    expect(match!.legend).toBe('Wraith');
    expect(match!.sessionId).toBe(1);
    expect(match!.shotsFired).toBe(150);
    expect(match!.shotsHit).toBe(45);
    expect(match!.survivalTime).toBe(900);
    expect(match!.rpChange).toBe(25);
    expect(match!.startedAt).toBe('2026-04-26T12:05:00Z');
    expect(match!.endedAt).toBe('2026-04-26T12:25:00Z');
  });

  it('should find matches by session id', () => {
    repo.create(sampleMatch());
    repo.create({ ...sampleMatch(), legend: 'Octane', startedAt: '2026-04-26T12:30:00Z' });

    const matches = repo.findBySessionId(1);
    expect(matches).toHaveLength(2);
    // Most recent first
    expect(matches[0].legend).toBe('Octane');
    expect(matches[1].legend).toBe('Wraith');
  });

  it('should find recent matches with limit', () => {
    for (let i = 0; i < 5; i++) {
      repo.create({ ...sampleMatch(), startedAt: `2026-04-26T12:0${i}:00Z` });
    }

    const recent = repo.findRecent(3);
    expect(recent).toHaveLength(3);
  });

  it('should find matches by legend', () => {
    repo.create(sampleMatch()); // Wraith
    repo.create({ ...sampleMatch(), legend: 'Octane' });
    repo.create({ ...sampleMatch(), legend: 'Wraith', startedAt: '2026-04-26T12:10:00Z' });

    const wraiths = repo.findByLegend('Wraith');
    expect(wraiths).toHaveLength(2);
    expect(wraiths.every(m => m.legend === 'Wraith')).toBe(true);
  });

  it('should count matches per legend', () => {
    repo.create(sampleMatch()); // Wraith
    repo.create({ ...sampleMatch(), legend: 'Wraith', startedAt: '2026-04-26T12:10:00Z' });
    repo.create({ ...sampleMatch(), legend: 'Octane' });

    const counts = repo.countByLegend();
    expect(counts).toHaveLength(2);
    expect(counts[0]).toEqual({ legend: 'Wraith', count: 2 });
    expect(counts[1]).toEqual({ legend: 'Octane', count: 1 });
  });

  it('should return undefined for non-existent match', () => {
    expect(repo.findById(999)).toBeUndefined();
  });
});
