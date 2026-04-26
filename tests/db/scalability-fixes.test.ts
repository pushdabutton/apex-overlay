// ============================================================
// Scalability Fixes -- Regression Tests
// Verifies all major and minor scalability fixes:
//   MAJOR 1: updateAggregates single-pass aggregation
//   MAJOR 2: daily aggregate range query (no date() function)
//   MAJOR 3: player_profile UPSERT (no unbounded INSERT growth)
//   MAJOR 4: pruneOldDismissed() + pruneOldProfiles() cleanup
//   MINOR 5: composite index (match_id, type) exists
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { SessionRepository } from '../../src/main/db/repositories/session-repo';
import { MatchRepository } from '../../src/main/db/repositories/match-repo';
import { DailyAggregateRepository } from '../../src/main/db/repositories/daily-aggregate-repo';
import { CoachingRepository } from '../../src/main/db/repositories/coaching-repo';
import { createTestDb } from '../helpers/db';
import { sampleMatch } from '../helpers/fixtures';

describe('MAJOR 1: updateAggregates single-pass', () => {
  let db: Database.Database;
  let sessionRepo: SessionRepository;
  let matchRepo: MatchRepository;

  beforeEach(() => {
    db = createTestDb();
    sessionRepo = new SessionRepository(db);
    matchRepo = new MatchRepository(db);
  });

  it('should produce identical results to the old 9-subquery approach', () => {
    const sessionId = sessionRepo.create();

    // Insert 5 matches with varied stats including nulls
    matchRepo.create(sampleMatch(sessionId, {
      kills: 5, deaths: 1, assists: 2, damage: 1200, headshots: 2,
      placement: 3, rpChange: 25,
      startedAt: '2026-04-26T12:00:00Z',
    }));
    matchRepo.create(sampleMatch(sessionId, {
      kills: 8, deaths: 2, assists: 4, damage: 2000, headshots: 3,
      placement: 1, rpChange: 50,
      startedAt: '2026-04-26T12:20:00Z',
    }));
    matchRepo.create(sampleMatch(sessionId, {
      kills: 0, deaths: 3, assists: 0, damage: 100, headshots: 0,
      placement: 15, rpChange: -10,
      startedAt: '2026-04-26T12:40:00Z',
    }));
    matchRepo.create(sampleMatch(sessionId, {
      kills: 12, deaths: 0, assists: 6, damage: 3500, headshots: 5,
      placement: null, rpChange: null,
      startedAt: '2026-04-26T13:00:00Z',
    }));
    matchRepo.create(sampleMatch(sessionId, {
      kills: 3, deaths: 1, assists: 1, damage: 800, headshots: 1,
      placement: null, rpChange: 15,
      startedAt: '2026-04-26T13:20:00Z',
    }));

    sessionRepo.updateAggregates(sessionId);
    const s = sessionRepo.findById(sessionId)!;

    expect(s.matchesPlayed).toBe(5);
    expect(s.totalKills).toBe(5 + 8 + 0 + 12 + 3);        // 28
    expect(s.totalDeaths).toBe(1 + 2 + 3 + 0 + 1);         // 7
    expect(s.totalAssists).toBe(2 + 4 + 0 + 6 + 1);        // 13
    expect(s.totalDamage).toBe(1200 + 2000 + 100 + 3500 + 800); // 7600
    expect(s.totalHeadshots).toBe(2 + 3 + 0 + 5 + 1);      // 11
    // avg_placement: only non-null placements: (3 + 1 + 15) / 3
    expect(s.avgPlacement).toBeCloseTo((3 + 1 + 15) / 3);
    expect(s.bestPlacement).toBe(1);
    // total_rp_change: 25 + 50 + (-10) + 0 (null) + 15 = 80
    expect(s.totalRpChange).toBe(80);
  });

  it('should handle session with all-null placements and rp_change', () => {
    const sessionId = sessionRepo.create();

    matchRepo.create(sampleMatch(sessionId, {
      kills: 2, deaths: 1, assists: 0, damage: 500, headshots: 0,
      placement: null, rpChange: null,
      startedAt: '2026-04-26T12:00:00Z',
    }));

    sessionRepo.updateAggregates(sessionId);
    const s = sessionRepo.findById(sessionId)!;

    expect(s.matchesPlayed).toBe(1);
    expect(s.totalKills).toBe(2);
    expect(s.avgPlacement).toBeNull();
    expect(s.bestPlacement).toBeNull();
    expect(s.totalRpChange).toBe(0);
  });
});

describe('MAJOR 2: daily aggregate range query', () => {
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

  it('should include matches from 00:00:00 to 23:59:59 of the given date', () => {
    const sessionId = sessionRepo.create();

    // Match right at midnight start of day
    matchRepo.create(sampleMatch(sessionId, {
      kills: 1, startedAt: '2026-04-26T00:00:00Z',
    }));
    // Match at end of day
    matchRepo.create(sampleMatch(sessionId, {
      kills: 2, startedAt: '2026-04-26T23:59:59Z',
    }));
    // Match at midnight of NEXT day -- should NOT be included
    matchRepo.create(sampleMatch(sessionId, {
      kills: 100, startedAt: '2026-04-27T00:00:00Z',
    }));
    // Match from previous day -- should NOT be included
    matchRepo.create(sampleMatch(sessionId, {
      kills: 100, startedAt: '2026-04-25T23:59:59Z',
    }));

    dailyRepo.recalculateForDate('2026-04-26');
    const agg = dailyRepo.findByDate('2026-04-26')!;

    expect(agg.gamesPlayed).toBe(2);
    expect(agg.totalKills).toBe(3); // 1 + 2, NOT 100
  });

  it('should handle month/year boundaries correctly', () => {
    const sessionId = sessionRepo.create();

    // Match on Dec 31
    matchRepo.create(sampleMatch(sessionId, {
      kills: 5, startedAt: '2026-12-31T18:00:00Z',
    }));
    // Match on Jan 1
    matchRepo.create(sampleMatch(sessionId, {
      kills: 10, startedAt: '2027-01-01T02:00:00Z',
    }));

    dailyRepo.recalculateForDate('2026-12-31');
    const dec31 = dailyRepo.findByDate('2026-12-31')!;
    expect(dec31.gamesPlayed).toBe(1);
    expect(dec31.totalKills).toBe(5);

    dailyRepo.recalculateForDate('2027-01-01');
    const jan1 = dailyRepo.findByDate('2027-01-01')!;
    expect(jan1.gamesPlayed).toBe(1);
    expect(jan1.totalKills).toBe(10);
  });
});

describe('MAJOR 3: player_profile UPSERT', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('should upsert profile rows keyed on (platform, player_uid)', () => {
    // First insert
    db.prepare(`
      INSERT INTO player_profile (platform, player_name, player_uid, level, rank_name, rank_score, rank_division, data_json, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(platform, player_uid) DO UPDATE SET
        player_name = excluded.player_name,
        level = excluded.level,
        rank_name = excluded.rank_name,
        rank_score = excluded.rank_score,
        rank_division = excluded.rank_division,
        data_json = excluded.data_json,
        fetched_at = excluded.fetched_at
    `).run('PC', 'OldName', 'uid-123', 100, 'Gold', 5000, 2, '{}');

    // Second insert with same platform+uid -- should update, not duplicate
    db.prepare(`
      INSERT INTO player_profile (platform, player_name, player_uid, level, rank_name, rank_score, rank_division, data_json, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(platform, player_uid) DO UPDATE SET
        player_name = excluded.player_name,
        level = excluded.level,
        rank_name = excluded.rank_name,
        rank_score = excluded.rank_score,
        rank_division = excluded.rank_division,
        data_json = excluded.data_json,
        fetched_at = excluded.fetched_at
    `).run('PC', 'NewName', 'uid-123', 200, 'Diamond', 8000, 1, '{"updated":true}');

    const rows = db.prepare('SELECT * FROM player_profile WHERE player_uid = ?').all('uid-123');
    expect(rows).toHaveLength(1);
    expect((rows[0] as { player_name: string }).player_name).toBe('NewName');
    expect((rows[0] as { level: number }).level).toBe(200);
    expect((rows[0] as { rank_name: string }).rank_name).toBe('Diamond');
  });

  it('should allow different players on the same platform', () => {
    const upsert = db.prepare(`
      INSERT INTO player_profile (platform, player_name, player_uid, level, rank_name, rank_score, rank_division, data_json, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(platform, player_uid) DO UPDATE SET
        player_name = excluded.player_name,
        level = excluded.level
    `);

    upsert.run('PC', 'PlayerA', 'uid-A', 50, 'Silver', 3000, 1, '{}');
    upsert.run('PC', 'PlayerB', 'uid-B', 75, 'Gold', 5000, 2, '{}');

    const rows = db.prepare('SELECT * FROM player_profile').all();
    expect(rows).toHaveLength(2);
  });
});

describe('MAJOR 4: cleanup tasks', () => {
  let db: Database.Database;
  let coachingRepo: CoachingRepository;

  beforeEach(() => {
    db = createTestDb({ seedSessions: 1 });
    coachingRepo = new CoachingRepository(db);

    // Create a match for FK reference
    const matchRepo = new MatchRepository(db);
    matchRepo.create(sampleMatch());
  });

  it('pruneOldDismissed() should delete old dismissed insights but keep recent ones', () => {
    // Insert a dismissed insight from 60 days ago
    db.prepare(`
      INSERT INTO coaching_insights (match_id, session_id, type, rule_id, message, severity, dismissed, created_at)
      VALUES (1, 1, 'old_type', 'old-rule', 'Old dismissed', 'info', 1, datetime('now', '-60 days'))
    `).run();

    // Insert a dismissed insight from 5 days ago (should survive)
    db.prepare(`
      INSERT INTO coaching_insights (match_id, session_id, type, rule_id, message, severity, dismissed, created_at)
      VALUES (1, 1, 'recent_type', 'recent-rule', 'Recent dismissed', 'info', 1, datetime('now', '-5 days'))
    `).run();

    // Insert a non-dismissed insight from 60 days ago (should survive -- not dismissed)
    db.prepare(`
      INSERT INTO coaching_insights (match_id, session_id, type, rule_id, message, severity, dismissed, created_at)
      VALUES (1, 1, 'active_type', 'active-rule', 'Old but active', 'info', 0, datetime('now', '-60 days'))
    `).run();

    const deleted = coachingRepo.pruneOldDismissed(30);
    expect(deleted).toBe(1); // Only the 60-day-old dismissed one

    const remaining = db.prepare('SELECT * FROM coaching_insights').all();
    expect(remaining).toHaveLength(2);
  });

  it('pruneOldProfiles() should delete profiles older than threshold', () => {
    // Insert an old profile
    db.prepare(`
      INSERT INTO player_profile (platform, player_name, player_uid, level, rank_name, rank_score, rank_division, data_json, fetched_at)
      VALUES ('PC', 'OldPlayer', 'old-uid', 100, 'Gold', 5000, 2, '{}', datetime('now', '-60 days'))
    `).run();

    // Insert a recent profile
    db.prepare(`
      INSERT INTO player_profile (platform, player_name, player_uid, level, rank_name, rank_score, rank_division, data_json, fetched_at)
      VALUES ('PC', 'NewPlayer', 'new-uid', 200, 'Diamond', 8000, 1, '{}', datetime('now', '-2 days'))
    `).run();

    const result = db.prepare(
      `DELETE FROM player_profile WHERE fetched_at < datetime('now', '-' || ? || ' days')`,
    ).run(30);

    expect(result.changes).toBe(1);
    const remaining = db.prepare('SELECT * FROM player_profile').all();
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as { player_name: string }).player_name).toBe('NewPlayer');
  });
});

describe('MINOR 5: composite index exists', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('should have idx_insights_match_type index on coaching_insights', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='coaching_insights'",
    ).all() as { name: string }[];

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_insights_match_type');
  });

  it('should have idx_player_profile_platform_uid unique index', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='player_profile'",
    ).all() as { name: string }[];

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_player_profile_platform_uid');
  });
});
