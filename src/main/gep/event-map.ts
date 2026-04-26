// ============================================================
// Event Map -- Maps raw GEP event names to domain events
// Parses GEP JSON payloads into typed domain event objects
// ============================================================

import type { DomainEvent, GameMode, GamePhase } from '../../shared/types';

/**
 * Parse a raw GEP event into a normalized domain event.
 * Returns null if the event is unrecognized or malformed.
 */
export function mapGepEvent(
  eventName: string,
  rawData: string,
  context: { matchStartTime: number }
): DomainEvent | null {
  const now = Date.now();
  const matchTime = context.matchStartTime > 0
    ? Math.floor((now - context.matchStartTime) / 1000)
    : 0;

  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    switch (eventName) {
      case 'match_start':
        return {
          type: 'MATCH_START',
          timestamp: now,
          mode: parseGameMode(data.mode),
        };

      case 'match_end':
        return {
          type: 'MATCH_END',
          timestamp: now,
        };

      case 'kill':
        return {
          type: 'PLAYER_KILL',
          victim: data.victimName ?? 'Unknown',
          weapon: data.weapon ?? 'Unknown',
          headshot: data.headshot === true || data.headshot === 'true',
          timestamp: now,
          matchTime,
        };

      case 'death':
        return {
          type: 'PLAYER_DEATH',
          attacker: data.attackerName ?? 'Unknown',
          weapon: data.weapon ?? 'Unknown',
          timestamp: now,
          matchTime,
        };

      case 'assist':
        return {
          type: 'PLAYER_ASSIST',
          timestamp: now,
          matchTime,
        };

      case 'knockdown':
        return {
          type: 'PLAYER_KNOCKDOWN',
          victim: data.victimName ?? 'Unknown',
          timestamp: now,
          matchTime,
        };

      case 'damage':
        return {
          type: 'DAMAGE_DEALT',
          amount: parseInt(data.damageAmount ?? '0', 10),
          target: data.targetName ?? 'Unknown',
          weapon: data.weapon ?? 'Unknown',
          timestamp: now,
        };

      case 'revive':
        return {
          type: 'PLAYER_REVIVE',
          teammate: data.revived ?? 'Unknown',
          timestamp: now,
        };

      case 'respawn':
        return {
          type: 'PLAYER_RESPAWN',
          teammate: data.respawned ?? 'Unknown',
          timestamp: now,
        };

      case 'legend_select':
        return {
          type: 'LEGEND_SELECTED',
          legend: data.legendName ?? data.legend ?? 'Unknown',
          timestamp: now,
        };

      case 'rank':
        return {
          type: 'RANK_UPDATE',
          rankName: data.rank ?? 'Unknown',
          rankScore: parseInt(data.rankScore ?? '0', 10),
          timestamp: now,
        };

      case 'placement':
        return {
          type: 'MATCH_PLACEMENT',
          position: parseInt(data.placement ?? '0', 10),
          timestamp: now,
        };

      case 'phase':
        return {
          type: 'GAME_PHASE',
          phase: parseGamePhase(data.phase),
          timestamp: now,
        };

      default:
        return null;
    }
  } catch (error) {
    console.error(`[EventMap] Failed to parse GEP event "${eventName}":`, error);
    return null;
  }
}

function parseGameMode(raw: string | undefined): GameMode {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower.includes('ranked')) return 'ranked';
  if (lower.includes('arena')) return 'arenas';
  if (lower.includes('ltm') || lower.includes('limited')) return 'ltm';
  if (lower.includes('battle') || lower.includes('br') || lower.includes('trios') || lower.includes('duos')) {
    return 'battle_royale';
  }
  return 'unknown';
}

function parseGamePhase(raw: string | undefined): GamePhase {
  if (!raw) return 'lobby';
  const lower = raw.toLowerCase();
  if (lower.includes('legend')) return 'legend_select';
  if (lower.includes('play') || lower.includes('match')) return 'playing';
  if (lower.includes('post') || lower.includes('summary')) return 'post_match';
  return 'lobby';
}
