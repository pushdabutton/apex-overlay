/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMatchStore } from '../../../src/renderer/stores/match-store';

describe('Match Store', () => {
  beforeEach(() => {
    useMatchStore.getState().resetMatch();
  });

  it('initial state is empty', () => {
    const state = useMatchStore.getState();
    expect(state.kills).toBe(0);
    expect(state.deaths).toBe(0);
    expect(state.assists).toBe(0);
    expect(state.damage).toBe(0);
    expect(state.headshots).toBe(0);
    expect(state.knockdowns).toBe(0);
    expect(state.legend).toBe('Unknown');
    expect(state.isInMatch).toBe(false);
    expect(state.placement).toBeNull();
    expect(state.map).toBeNull();
    expect(state.coachingInsights).toEqual([]);
    expect(state.rankName).toBeNull();
    expect(state.rankScore).toBeNull();
    expect(state.weapons).toEqual({});
  });

  it('setMatchResult stores placement, kills, damage, legend, map, mode', () => {
    useMatchStore.getState().setMatchResult({
      placement: 2,
      kills: 8,
      deaths: 1,
      assists: 3,
      damage: 2100,
      legend: 'Horizon',
      map: 'World\'s Edge',
      mode: 'ranked',
    });

    const state = useMatchStore.getState();
    expect(state.placement).toBe(2);
    expect(state.kills).toBe(8);
    expect(state.deaths).toBe(1);
    expect(state.assists).toBe(3);
    expect(state.damage).toBe(2100);
    expect(state.legend).toBe('Horizon');
    expect(state.map).toBe('World\'s Edge');
    expect(state.mode).toBe('ranked');
  });

  it('updateFromIpc updates in-match stats', () => {
    useMatchStore.getState().updateFromIpc({
      kills: 8,
      damage: 2100,
      legend: 'Horizon',
    });

    const state = useMatchStore.getState();
    expect(state.kills).toBe(8);
    expect(state.damage).toBe(2100);
    expect(state.legend).toBe('Horizon');
    expect(state.isInMatch).toBe(true);
  });

  it('resetMatch resets to initial state', () => {
    useMatchStore.getState().setMatchResult({
      placement: 1,
      kills: 5,
      deaths: 1,
      assists: 2,
      damage: 1500,
      legend: 'Wraith',
      map: 'Storm Point',
      mode: 'battle_royale',
    });

    useMatchStore.getState().resetMatch();

    const state = useMatchStore.getState();
    expect(state.kills).toBe(0);
    expect(state.deaths).toBe(0);
    expect(state.damage).toBe(0);
    expect(state.legend).toBe('Unknown');
    expect(state.isInMatch).toBe(false);
    expect(state.placement).toBeNull();
    expect(state.map).toBeNull();
    expect(state.mode).toBeNull();
    expect(state.coachingInsights).toEqual([]);
  });

  it('addCoachingInsight appends insight to list', () => {
    useMatchStore.getState().addCoachingInsight({
      id: 1,
      matchId: 1,
      sessionId: 1,
      type: 'session_vs_average',
      ruleId: 'test-rule',
      message: 'Your headshot rate dropped 5%',
      severity: 'warning',
      dataJson: null,
      dismissed: false,
      createdAt: '2025-01-01T00:00:00Z',
    });

    const state = useMatchStore.getState();
    expect(state.coachingInsights).toHaveLength(1);
    expect(state.coachingInsights[0].message).toBe('Your headshot rate dropped 5%');
  });

  it('updateFromIpc handles rank updates', () => {
    // Gold II range: 6800-7499 (Season 24 thresholds)
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Gold II',
      rankScore: 7339,
    });

    const state = useMatchStore.getState();
    expect(state.rankName).toBe('Gold II');
    expect(state.rankScore).toBe(7339);
  });

  it('updateFromIpc handles rank update without score', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Platinum III',
    });

    const state = useMatchStore.getState();
    expect(state.rankName).toBe('Platinum III');
    expect(state.rankScore).toBeNull(); // No score provided, stays null
  });

  it('updateFromIpc handles weapons updates', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'R-301 Carbine', weapon1: 'Peacekeeper' },
    });

    const state = useMatchStore.getState();
    expect(state.weapons).toEqual({
      weapon0: 'R-301 Carbine',
      weapon1: 'Peacekeeper',
    });
  });

  it('updateFromIpc replaces weapons entirely on update', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'R-301 Carbine', weapon1: 'Peacekeeper' },
    });
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'Flatline' },
    });

    const state = useMatchStore.getState();
    expect(state.weapons).toEqual({ weapon0: 'Flatline' });
    // weapon1 is gone because the whole object was replaced
    expect(state.weapons.weapon1).toBeUndefined();
  });

  it('resetMatch clears rank and weapons data', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Diamond I',
      rankScore: 10500,
    });
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'Wingman', weapon1: 'R-99' },
    });

    useMatchStore.getState().resetMatch();

    const state = useMatchStore.getState();
    expect(state.rankName).toBeNull();
    expect(state.rankScore).toBeNull();
    expect(state.weapons).toEqual({});
  });
});
