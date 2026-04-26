// ============================================================
// Daily Aggregates -- Unit Tests
// Tests recalculateForDate(), findByDate(), findRecent().
// Verifies daily_aggregates table is properly populated
// so session-comparison coaching rules can query it.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { DailyAggregateRepository } from '../../src/main/db/repositories/daily-aggregate-repo';
import { MatchRepository } from '../../src/main/db/repositories/match-repo';
import { SessionRepository } from '../../src/main/db/repositories/session-repo';
import { createTestDb } from '../helpers/db';
import { sampleMatch } from '../helpers/fixtures';

describe('DailyAggregateRepository', () => {
  let db: Database.Database;
  let dailyRepo: DailyAggregateRepository;
  let matchRepo: MatchRepository;
  let sessionRepo: SessionRepository;

  beforeEach(() => {
    db = createTestDb();
    dailyRepo = new DailyAggregateRepository(db);
    matchRepo = new MatchRepository(db);
    sessionRepo = new SessionRepository(db);
  });

  it('should compute correct daily aggregates from matches on that date', () => {
    const sessionId = sessionRepo.create();

    // Two matches on 2026-04-26
    matchRepo.create(sampleMatch(sessionId, {
      kills: 5, deaths: 1, damage: 1200, headshots: 2, placement: 3, rpChange: 25,
      startedAt: '2026-04-26T12:00:00Z',
    }));
    matchRepo.create(sampleMatch(sessionId, {
      kills: 8, deaths: 2, damage: 2000, headshots: 3, placement: 1, rpChange: 50,
      startedAt: '2026-04-26T14:00:00Z',
    }));

    dailyRepo.recalculateForDate('2026-04-26');

    const agg = dailyRepo.findByDate('2026-04-26');
    expect(agg).toBeDefined();
    expect(agg!.gamesPlayed).toBe(2);
    expect(agg!.totalKills).toBe(13);
    expect(agg!.totalDeaths).toBe(3);
    expect(agg!.totalDamage).toBe(3200);
    expect(agg!.totalHeadshots).toBe(5);
    expect(agg!.avgPlacement).toBe(2); // (3+1)/2
    expect(agg!.totalRpChange).toBe(75);
  });

  it('should return empty aggregate for a date with no matches', () => {
    dailyRepo.recalculateForDate('2026-01-01');

    const agg = dailyRepo.findByDate('2026-01-01');
    expect(agg).toBeDefined();
    expect(agg!.gamesPlayed).toBe(0);
    expect(agg!.totalKills).toBe(0);
    expect(agg!.totalDamage).toBe(0);
  });

  it('should UPSERT on re-calculation (update, not duplicate)', () => {
    const sessionId = sessionRepo.create();

    matchRepo.create(sampleMatch(sessionId, {
      kills: 5, damage: 1200,
      startedAt: '2026-04-26T12:00:00Z',
    }));

    dailyRepo.recalculateForDate('2026-04-26');
    let agg = dailyRepo.findByDate('2026-04-26')!;
    expect(agg.gamesPlayed).toBe(1);
    expect(agg.totalKills).toBe(5);

    // Add another match on the same date
    matchRepo.create(sampleMatch(sessionId, {
      kills: 10, damage: 3000,
      startedAt: '2026-04-26T15:00:00Z',
    }));

    // Recalculate -- should update, not create a second row
    dailyRepo.recalculateForDate('2026-04-26');
    agg = dailyRepo.findByDate('2026-04-26')!;
    expect(agg.gamesPlayed).toBe(2);
    expect(agg.totalKills).toBe(15);
    expect(agg.totalDamage).toBe(4200);

    // Verify only one row exists for that date
    const all = dailyRepo.findRecent(100);
    const april26 = all.filter(a => a.date === '2026-04-26');
    expect(april26).toHaveLength(1);
  });

  it('should keep different dates separate', () => {
    const sessionId = sessionRepo.create();

    matchRepo.create(sampleMatch(sessionId, {
      kills: 5, damage: 1200,
      startedAt: '2026-04-25T18:00:00Z',
    }));
    matchRepo.create(sampleMatch(sessionId, {
      kills: 8, damage: 2000,
      startedAt: '2026-04-26T10:00:00Z',
    }));

    dailyRepo.recalculateForDate('2026-04-25');
    dailyRepo.recalculateForDate('2026-04-26');

    const day25 = dailyRepo.findByDate('2026-04-25')!;
    const day26 = dailyRepo.findByDate('2026-04-26')!;

    expect(day25.totalKills).toBe(5);
    expect(day26.totalKills).toBe(8);
  });

  it('should return recent daily aggregates in newest-first order', () => {
    const sessionId = sessionRepo.create();

    // Create matches across 3 days
    matchRepo.create(sampleMatch(sessionId, { startedAt: '2026-04-24T12:00:00Z' }));
    matchRepo.create(sampleMatch(sessionId, { startedAt: '2026-04-25T12:00:00Z' }));
    matchRepo.create(sampleMatch(sessionId, { startedAt: '2026-04-26T12:00:00Z' }));

    dailyRepo.recalculateForDate('2026-04-24');
    dailyRepo.recalculateForDate('2026-04-25');
    dailyRepo.recalculateForDate('2026-04-26');

    const recent = dailyRepo.findRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].date).toBe('2026-04-26');
    expect(recent[1].date).toBe('2026-04-25');
  });
});
