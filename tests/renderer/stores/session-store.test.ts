/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../../../src/renderer/stores/session-store';

describe('Session Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSessionStore.getState().resetSession();
  });

  it('initial state has zero stats', () => {
    const state = useSessionStore.getState();
    expect(state.matchesPlayed).toBe(0);
    expect(state.totalKills).toBe(0);
    expect(state.totalDeaths).toBe(0);
    expect(state.totalAssists).toBe(0);
    expect(state.totalDamage).toBe(0);
    expect(state.totalHeadshots).toBe(0);
    expect(state.avgKills).toBe(0);
    expect(state.avgDamage).toBe(0);
    expect(state.bestPlacement).toBeNull();
    expect(state.kd).toBe('0.00');
  });

  it('updateFromIpc correctly updates kills, deaths, damage, assists', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 15,
      totalDeaths: 5,
      totalDamage: 3200,
      totalAssists: 8,
      matchesPlayed: 3,
    });

    const state = useSessionStore.getState();
    expect(state.totalKills).toBe(15);
    expect(state.totalDeaths).toBe(5);
    expect(state.totalDamage).toBe(3200);
    expect(state.totalAssists).toBe(8);
    expect(state.matchesPlayed).toBe(3);
  });

  it('updateFromIpc updates knockdowns and headshots', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 10,
      totalDeaths: 2,
      totalDamage: 2000,
      totalAssists: 4,
      totalHeadshots: 7,
      totalKnockdowns: 12,
      matchesPlayed: 2,
    });

    const state = useSessionStore.getState();
    expect(state.totalHeadshots).toBe(7);
    expect(state.totalKnockdowns).toBe(12);
  });

  it('resetSession clears all stats', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 10,
      totalDeaths: 3,
      totalDamage: 2000,
      matchesPlayed: 2,
    });

    useSessionStore.getState().resetSession();

    const state = useSessionStore.getState();
    expect(state.totalKills).toBe(0);
    expect(state.totalDeaths).toBe(0);
    expect(state.totalDamage).toBe(0);
    expect(state.matchesPlayed).toBe(0);
    expect(state.kd).toBe('0.00');
  });

  it('computed K/D ratio handles zero deaths (returns kills, not Infinity)', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 7,
      totalDeaths: 0,
      matchesPlayed: 1,
    });

    const state = useSessionStore.getState();
    // With zero deaths and kills > 0, should return kills.00, not Infinity
    expect(state.kd).toBe('7.00');
    expect(Number(state.kd)).not.toBe(Infinity);
  });

  it('computed damage per game handles zero matches', () => {
    // With zero matches, avgDamage should be 0 (not NaN or Infinity)
    const state = useSessionStore.getState();
    expect(state.avgDamage).toBe(0);
    expect(Number.isFinite(state.avgDamage)).toBe(true);
  });

  it('computed damagePerGame calculates correctly with matches', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 10,
      totalDeaths: 4,
      totalDamage: 4500,
      matchesPlayed: 3,
    });

    const state = useSessionStore.getState();
    expect(state.avgDamage).toBe(1500);
  });

  it('computed kd ratio calculates correctly', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 10,
      totalDeaths: 4,
      matchesPlayed: 2,
    });

    const state = useSessionStore.getState();
    expect(state.kd).toBe('2.50');
  });
});
