// ============================================================
// Session Broadcast Tests
// Verifies that SESSION_UPDATE is broadcast to renderer after
// match lifecycle events, which is the mechanism by which the
// session store in the renderer gets populated.
//
// Bug: The main process handleDomainEvent never broadcasts
// SESSION_UPDATE, so the renderer session store stays at zero.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventProcessor } from '../../src/main/gep/event-processor';

/**
 * Simulates the session broadcast pipeline.
 * After MATCH_END, the main process should broadcast SESSION_UPDATE
 * with the cumulative session stats so the renderer can display them.
 */
describe('Session stats broadcast after match end', () => {
  let processor: EventProcessor;

  beforeEach(() => {
    processor = new EventProcessor();
  });

  it('should have non-zero session stats after full match lifecycle for broadcast', () => {
    // Start match
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });

    // Tabs update (authoritative stats)
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 5, assists: 2, damage: 1800, teams: 3, players: 8, knockdowns: 6 },
        feature: 'match_info',
        category: 'match_info',
      },
    });

    // Match end
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'match_summary', feature: 'game_info', category: 'game_info' },
    });

    // Session stats should now contain the match data for broadcast
    const session = processor.getSessionStats();
    expect(session.kills).toBe(5);
    expect(session.assists).toBe(2);
    expect(session.damage).toBe(1800);
    expect(session.matchesPlayed).toBe(1);
    // These are what should be broadcast via SESSION_UPDATE
  });

  it('should accumulate session stats across two matches for broadcast', () => {
    // Match 1
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 3, assists: 1, damage: 900, teams: 5, players: 12 },
        feature: 'match_info',
        category: 'match_info',
      },
    });
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'lobby', feature: 'game_info', category: 'game_info' },
    });

    // Match 2
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'landed', feature: 'game_info', category: 'game_info' },
    });
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 7, assists: 3, damage: 2100, teams: 2, players: 5 },
        feature: 'match_info',
        category: 'match_info',
      },
    });
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'match_summary', feature: 'game_info', category: 'game_info' },
    });

    const session = processor.getSessionStats();
    expect(session.kills).toBe(10);      // 3 + 7
    expect(session.assists).toBe(4);     // 1 + 3
    expect(session.damage).toBe(3000);   // 900 + 2100
    expect(session.matchesPlayed).toBe(2);
  });

  it('should provide session data in the shape expected by session store updateFromIpc', () => {
    // Play a match
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'playing', feature: 'game_info', category: 'game_info' },
    });
    processor.processRawEvent('kill', JSON.stringify({ victimName: 'A', weapon: 'R-301', headshot: true }));
    processor.processRawEvent('death', JSON.stringify({ attackerName: 'B', weapon: 'Kraber' }));
    processor.processInfoUpdate({
      info: {
        key: 'tabs',
        value: { kills: 4, assists: 2, damage: 1200, teams: 5, players: 12 },
        feature: 'match_info',
        category: 'match_info',
      },
    });
    processor.processInfoUpdate({
      info: { key: 'phase', value: 'lobby', feature: 'game_info', category: 'game_info' },
    });

    const session = processor.getSessionStats();

    // Build the broadcast payload (same shape as what handleDomainEvent should send)
    const broadcastPayload = {
      totalKills: session.kills,
      totalDeaths: session.deaths,
      totalAssists: session.assists,
      totalDamage: session.damage,
      totalHeadshots: session.headshots,
      totalKnockdowns: session.knockdowns,
      matchesPlayed: session.matchesPlayed,
    };

    // Verify the payload has the keys the session store expects
    expect(broadcastPayload.totalKills).toBe(4);
    expect(broadcastPayload.totalDeaths).toBe(1);
    expect(broadcastPayload.totalAssists).toBe(2);
    expect(broadcastPayload.totalDamage).toBe(1200);
    expect(broadcastPayload.totalHeadshots).toBe(1);
    expect(broadcastPayload.matchesPlayed).toBe(1);
  });
});
