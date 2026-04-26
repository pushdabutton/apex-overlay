// ============================================================
// Session Lifecycle -- Unit Tests
// Tests create, close, aggregates, zero-match edge case,
// multi-session independence.
// Uses shared test helpers.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SessionRepository } from '../../src/main/db/repositories/session-repo';
import { MatchRepository } from '../../src/main/db/repositories/match-repo';
import { createTestDb } from '../helpers/db';
import { sampleMatch } from '../helpers/fixtures';

describe('Session Lifecycle', () => {
  let db: Database.Database;
  let sessionRepo: SessionRepository;
  let matchRepo: MatchRepository;

  beforeEach(() => {
    db = createTestDb();
    sessionRepo = new SessionRepository(db);
    matchRepo = new MatchRepository(db);
  });

  it('should create a session and return an ID', () => {
    const id = sessionRepo.create();
    expect(id).toBeGreaterThan(0);

    const session = sessionRepo.findById(id);
    expect(session).toBeDefined();
    expect(session!.id).toBe(id);
    expect(session!.startedAt).toBeTruthy();
    expect(session!.endedAt).toBeNull();
  });

  it('should close a session by setting end_time', () => {
    const id = sessionRepo.create();
    sessionRepo.close(id);

    const session = sessionRepo.findById(id);
    expect(session).toBeDefined();
    expect(session!.endedAt).toBeTruthy();
    expect(session!.endedAt).not.toBeNull();
  });

  it('should compute correct aggregates from child matches via updateAggregates', () => {
    const sessionId = sessionRepo.create();

    // Add two matches to this session
    matchRepo.create(sampleMatch(sessionId, {
      kills: 5, deaths: 1, assists: 2, damage: 1200, headshots: 2, placement: 3, rpChange: 25,
    }));
    matchRepo.create(sampleMatch(sessionId, {
      legend: 'Octane',
      kills: 8, deaths: 2, assists: 4, damage: 2000, headshots: 3, placement: 1, rpChange: 50,
      startedAt: '2026-04-26T12:30:00Z',
    }));

    sessionRepo.updateAggregates(sessionId);
    const session = sessionRepo.findById(sessionId)!;

    expect(session.matchesPlayed).toBe(2);
    expect(session.totalKills).toBe(13);
    expect(session.totalDeaths).toBe(3);
    expect(session.totalAssists).toBe(6);
    expect(session.totalDamage).toBe(3200);
    expect(session.totalHeadshots).toBe(5);
    expect(session.avgPlacement).toBe(2); // (3+1)/2
    expect(session.bestPlacement).toBe(1);
    expect(session.totalRpChange).toBe(75);
  });

  it('should have zero aggregates for a session with no matches', () => {
    const sessionId = sessionRepo.create();
    sessionRepo.updateAggregates(sessionId);

    const session = sessionRepo.findById(sessionId)!;

    expect(session.matchesPlayed).toBe(0);
    expect(session.totalKills).toBe(0);
    expect(session.totalDeaths).toBe(0);
    expect(session.totalAssists).toBe(0);
    expect(session.totalDamage).toBe(0);
    expect(session.totalHeadshots).toBe(0);
    expect(session.avgPlacement).toBeNull();
    expect(session.bestPlacement).toBeNull();
    expect(session.totalRpChange).toBe(0);
  });

  it('should keep multiple sessions independent', () => {
    const session1 = sessionRepo.create();
    const session2 = sessionRepo.create();

    matchRepo.create(sampleMatch(session1, { kills: 10, damage: 2000 }));
    matchRepo.create(sampleMatch(session2, { kills: 3, damage: 500, startedAt: '2026-04-26T14:00:00Z' }));

    sessionRepo.updateAggregates(session1);
    sessionRepo.updateAggregates(session2);

    const s1 = sessionRepo.findById(session1)!;
    const s2 = sessionRepo.findById(session2)!;

    expect(s1.totalKills).toBe(10);
    expect(s1.totalDamage).toBe(2000);
    expect(s2.totalKills).toBe(3);
    expect(s2.totalDamage).toBe(500);
  });
});
