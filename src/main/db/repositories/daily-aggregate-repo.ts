// ============================================================
// Daily Aggregate Repository -- Pre-computed daily summaries
// for trend analysis. Includes row mapper and recalculation.
// ============================================================

import type Database from 'better-sqlite3';
import type { DailyAggregate } from '../../../shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDailyAggregateRow(row: any): DailyAggregate {
  return {
    date: row.date,
    gamesPlayed: row.games_played ?? 0,
    totalKills: row.total_kills ?? 0,
    totalDeaths: row.total_deaths ?? 0,
    totalDamage: row.total_damage ?? 0,
    totalHeadshots: row.total_headshots ?? 0,
    avgPlacement: row.avg_placement ?? null,
    totalRpChange: row.total_rp_change ?? 0,
  };
}

export class DailyAggregateRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Recalculate the daily aggregate row for the given date.
   * Queries all matches whose started_at falls on that date
   * and UPSERTs the result into daily_aggregates.
   *
   * Uses a range query (started_at >= dayStart AND started_at < nextDayStart)
   * instead of date(started_at) = ? so the idx_matches_started index is used.
   *
   * @param date ISO date string (YYYY-MM-DD), e.g. '2026-04-26'
   */
  recalculateForDate(date: string): void {
    // Compute day boundaries for index-friendly range query
    const dayStart = `${date}T00:00:00`;
    const nextDay = this.nextDate(date);
    const dayEnd = `${nextDay}T00:00:00`;

    this.db.prepare(`
      INSERT INTO daily_aggregates (
        date, games_played, total_kills, total_deaths, total_damage,
        total_headshots, avg_placement, total_rp_change, updated_at
      )
      SELECT
        ?,
        COUNT(*),
        COALESCE(SUM(kills), 0),
        COALESCE(SUM(deaths), 0),
        COALESCE(SUM(damage), 0),
        COALESCE(SUM(headshots), 0),
        AVG(placement),
        COALESCE(SUM(rp_change), 0),
        datetime('now')
      FROM matches
      WHERE started_at >= ? AND started_at < ?
      ON CONFLICT(date) DO UPDATE SET
        games_played = excluded.games_played,
        total_kills = excluded.total_kills,
        total_deaths = excluded.total_deaths,
        total_damage = excluded.total_damage,
        total_headshots = excluded.total_headshots,
        avg_placement = excluded.avg_placement,
        total_rp_change = excluded.total_rp_change,
        updated_at = excluded.updated_at
    `).run(date, dayStart, dayEnd);
  }

  /**
   * Returns the next calendar date as YYYY-MM-DD.
   */
  private nextDate(date: string): string {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Convenience: recalculate for today's date (UTC).
   */
  recalculateToday(): void {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    this.recalculateForDate(today);
  }

  findByDate(date: string): DailyAggregate | undefined {
    const row = this.db.prepare(
      'SELECT * FROM daily_aggregates WHERE date = ?',
    ).get(date);
    return row ? mapDailyAggregateRow(row) : undefined;
  }

  findRecent(limit: number = 7): DailyAggregate[] {
    const rows = this.db.prepare(
      'SELECT * FROM daily_aggregates ORDER BY date DESC LIMIT ?',
    ).all(limit);
    return rows.map(mapDailyAggregateRow);
  }
}
