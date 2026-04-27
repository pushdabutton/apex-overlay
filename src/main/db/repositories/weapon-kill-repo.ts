// ============================================================
// Weapon Kill Repository -- Data access for the weapon_kills
// table. Stores per-weapon kill data aggregated from PLAYER_KILL
// domain events during a match.
// ============================================================

import type Database from 'better-sqlite3';

export interface WeaponKillRecord {
  id: number;
  matchId: number;
  sessionId: number | null;
  weapon: string;
  kills: number;
  headshots: number;
  damage: number;
  createdAt: string;
}

export interface WeaponKillInput {
  matchId: number;
  sessionId: number | null;
  weapon: string;
  kills: number;
  headshots: number;
  damage: number;
}

export interface WeaponKillSummary {
  weapon: string;
  kill_count: number;
  headshot_count: number;
  total_damage: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): WeaponKillRecord {
  return {
    id: row.id,
    matchId: row.match_id,
    sessionId: row.session_id ?? null,
    weapon: row.weapon,
    kills: row.kills,
    headshots: row.headshots,
    damage: row.damage,
    createdAt: row.created_at,
  };
}

export class WeaponKillRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Insert a single weapon kill record.
   */
  create(input: WeaponKillInput): number {
    const result = this.db.prepare(`
      INSERT INTO weapon_kills (match_id, session_id, weapon, kills, headshots, damage)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      input.matchId,
      input.sessionId,
      input.weapon,
      input.kills,
      input.headshots,
      input.damage,
    );
    return Number(result.lastInsertRowid);
  }

  /**
   * Bulk-insert weapon kill records for a single match.
   * Each entry is one weapon with aggregated kills/headshots/damage.
   */
  bulkCreate(inputs: WeaponKillInput[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO weapon_kills (match_id, session_id, weapon, kills, headshots, damage)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((records: WeaponKillInput[]) => {
      for (const input of records) {
        stmt.run(
          input.matchId,
          input.sessionId,
          input.weapon,
          input.kills,
          input.headshots,
          input.damage,
        );
      }
    });

    insertMany(inputs);
  }

  /**
   * Find all weapon kill records for a specific match.
   */
  findByMatch(matchId: number): WeaponKillRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM weapon_kills WHERE match_id = ? ORDER BY kills DESC',
    ).all(matchId);
    return rows.map(mapRow);
  }

  /**
   * Find recent weapon kills aggregated across all matches, ordered by kill count.
   */
  findRecent(limit: number = 20): WeaponKillSummary[] {
    return this.db.prepare(`
      SELECT weapon, SUM(kills) as kill_count, SUM(headshots) as headshot_count, SUM(damage) as total_damage
      FROM weapon_kills
      GROUP BY weapon
      ORDER BY kill_count DESC
      LIMIT ?
    `).all(limit) as WeaponKillSummary[];
  }

  /**
   * Get weapon kill summary for a specific match.
   */
  findSummaryByMatch(matchId: number): WeaponKillSummary[] {
    return this.db.prepare(`
      SELECT weapon, SUM(kills) as kill_count, SUM(headshots) as headshot_count, SUM(damage) as total_damage
      FROM weapon_kills
      WHERE match_id = ?
      GROUP BY weapon
      ORDER BY kill_count DESC
    `).all(matchId) as WeaponKillSummary[];
  }
}
