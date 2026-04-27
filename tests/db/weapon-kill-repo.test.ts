// ============================================================
// Weapon Kill Repository -- Unit Tests
// Tests create, bulkCreate, findByMatch, findRecent,
// and findSummaryByMatch on the weapon_kills table.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { WeaponKillRepository } from '../../src/main/db/repositories/weapon-kill-repo';
import { MatchRepository } from '../../src/main/db/repositories/match-repo';
import { createTestDb } from '../helpers/db';
import { sampleMatch } from '../helpers/fixtures';

describe('WeaponKillRepository', () => {
  let db: Database.Database;
  let repo: WeaponKillRepository;
  let matchId: number;

  beforeEach(() => {
    db = createTestDb({ seedSessions: 1 });
    const matchRepo = new MatchRepository(db);
    matchId = matchRepo.create(sampleMatch({ legend: 'Wraith' }));
    repo = new WeaponKillRepository(db);
  });

  it('should create a single weapon kill record', () => {
    const id = repo.create({
      matchId,
      sessionId: 1,
      weapon: 'R-301',
      kills: 5,
      headshots: 2,
      damage: 600,
    });

    expect(id).toBeGreaterThan(0);

    const records = repo.findByMatch(matchId);
    expect(records).toHaveLength(1);
    expect(records[0].weapon).toBe('R-301');
    expect(records[0].kills).toBe(5);
    expect(records[0].headshots).toBe(2);
    expect(records[0].damage).toBe(600);
  });

  it('should bulk-create weapon kill records in a transaction', () => {
    repo.bulkCreate([
      { matchId, sessionId: 1, weapon: 'R-301', kills: 5, headshots: 2, damage: 600 },
      { matchId, sessionId: 1, weapon: 'Peacekeeper', kills: 3, headshots: 0, damage: 300 },
      { matchId, sessionId: 1, weapon: 'Wingman', kills: 2, headshots: 1, damage: 200 },
    ]);

    const records = repo.findByMatch(matchId);
    expect(records).toHaveLength(3);
    // Ordered by kills DESC
    expect(records[0].weapon).toBe('R-301');
    expect(records[1].weapon).toBe('Peacekeeper');
    expect(records[2].weapon).toBe('Wingman');
  });

  it('should find recent weapon kills aggregated across matches', () => {
    // Create a second match
    const matchRepo = new MatchRepository(db);
    const matchId2 = matchRepo.create(sampleMatch({
      legend: 'Octane',
      startedAt: '2026-04-26T13:00:00Z',
    }));

    // R-301 used in both matches
    repo.bulkCreate([
      { matchId, sessionId: 1, weapon: 'R-301', kills: 5, headshots: 2, damage: 600 },
      { matchId, sessionId: 1, weapon: 'Peacekeeper', kills: 3, headshots: 0, damage: 300 },
    ]);
    repo.bulkCreate([
      { matchId: matchId2, sessionId: 1, weapon: 'R-301', kills: 4, headshots: 1, damage: 500 },
      { matchId: matchId2, sessionId: 1, weapon: 'Wingman', kills: 2, headshots: 1, damage: 200 },
    ]);

    const summary = repo.findRecent(10);
    expect(summary).toHaveLength(3);
    // R-301: 5+4=9 kills
    expect(summary[0].weapon).toBe('R-301');
    expect(summary[0].kill_count).toBe(9);
    // Peacekeeper: 3 kills
    expect(summary[1].weapon).toBe('Peacekeeper');
    expect(summary[1].kill_count).toBe(3);
    // Wingman: 2 kills
    expect(summary[2].weapon).toBe('Wingman');
    expect(summary[2].kill_count).toBe(2);
  });

  it('should find summary by match', () => {
    repo.bulkCreate([
      { matchId, sessionId: 1, weapon: 'R-301', kills: 5, headshots: 2, damage: 600 },
      { matchId, sessionId: 1, weapon: 'Flatline', kills: 3, headshots: 1, damage: 400 },
    ]);

    const summary = repo.findSummaryByMatch(matchId);
    expect(summary).toHaveLength(2);
    expect(summary[0].weapon).toBe('R-301');
    expect(summary[0].kill_count).toBe(5);
    expect(summary[0].headshot_count).toBe(2);
    expect(summary[0].total_damage).toBe(600);
  });

  it('should return empty arrays when no weapon kills exist', () => {
    expect(repo.findByMatch(999)).toHaveLength(0);
    expect(repo.findRecent()).toHaveLength(0);
    expect(repo.findSummaryByMatch(999)).toHaveLength(0);
  });
});
