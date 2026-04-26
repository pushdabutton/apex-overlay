// ============================================================
// Legend Stats Repository -- Aggregated per-legend performance
// Includes row mapper for snake_case -> camelCase conversion.
// ============================================================

import type Database from 'better-sqlite3';
import type { LegendStats } from '../../../shared/types';
import { nowISO } from '../../../shared/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLegendStatsRow(row: any): LegendStats {
  return {
    legend: row.legend,
    gamesPlayed: row.games_played ?? 0,
    totalKills: row.total_kills ?? 0,
    totalDeaths: row.total_deaths ?? 0,
    totalAssists: row.total_assists ?? 0,
    totalDamage: row.total_damage ?? 0,
    totalHeadshots: row.total_headshots ?? 0,
    totalWins: row.total_wins ?? 0,
    avgDamage: row.avg_damage ?? 0,
    avgKills: row.avg_kills ?? 0,
    avgPlacement: row.avg_placement ?? null,
    bestDamage: row.best_damage ?? 0,
    bestKills: row.best_kills ?? 0,
    winRate: row.win_rate ?? 0,
    lastPlayed: row.last_played ?? null,
  };
}

export class LegendStatsRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  findAll(): LegendStats[] {
    const rows = this.db.prepare(
      'SELECT * FROM legend_stats ORDER BY games_played DESC',
    ).all();
    return rows.map(mapLegendStatsRow);
  }

  findByLegend(legend: string): LegendStats | undefined {
    const row = this.db.prepare(
      'SELECT * FROM legend_stats WHERE legend = ?',
    ).get(legend);
    return row ? mapLegendStatsRow(row) : undefined;
  }

  /**
   * Recalculate legend stats from match history.
   * Called after each match to keep aggregates current.
   */
  recalculate(legend: string): void {
    this.db.prepare(`
      INSERT INTO legend_stats (legend, games_played, total_kills, total_deaths, total_assists,
        total_damage, total_headshots, total_wins, avg_damage, avg_kills, avg_placement,
        best_damage, best_kills, win_rate, last_played, updated_at)
      SELECT
        legend,
        COUNT(*) as games_played,
        COALESCE(SUM(kills), 0),
        COALESCE(SUM(deaths), 0),
        COALESCE(SUM(assists), 0),
        COALESCE(SUM(damage), 0),
        COALESCE(SUM(headshots), 0),
        COALESCE(SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END), 0),
        AVG(damage),
        AVG(kills),
        AVG(placement),
        MAX(damage),
        MAX(kills),
        CAST(SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*),
        MAX(started_at),
        ?
      FROM matches WHERE legend = ?
      ON CONFLICT(legend) DO UPDATE SET
        games_played = excluded.games_played,
        total_kills = excluded.total_kills,
        total_deaths = excluded.total_deaths,
        total_assists = excluded.total_assists,
        total_damage = excluded.total_damage,
        total_headshots = excluded.total_headshots,
        total_wins = excluded.total_wins,
        avg_damage = excluded.avg_damage,
        avg_kills = excluded.avg_kills,
        avg_placement = excluded.avg_placement,
        best_damage = excluded.best_damage,
        best_kills = excluded.best_kills,
        win_rate = excluded.win_rate,
        last_played = excluded.last_played,
        updated_at = excluded.updated_at
    `).run(nowISO(), legend);
  }
}
