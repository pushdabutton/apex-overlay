/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { installMockBridge } from '../test-utils';
import { PostMatchSummary } from '../../../src/renderer/windows/PostMatch/PostMatchSummary';
import { useMatchStore } from '../../../src/renderer/stores/match-store';
import { useSessionStore } from '../../../src/renderer/stores/session-store';

describe('PostMatchSummary', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    useMatchStore.getState().resetMatch();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('shows placement', () => {
    useMatchStore.getState().setMatchResult({
      placement: 2,
      kills: 5,
      deaths: 1,
      assists: 2,
      damage: 1500,
      legend: 'Horizon',
      map: 'Storm Point',
      mode: null,
    });

    render(<PostMatchSummary />);
    expect(screen.getByText('#2')).toBeDefined();
  });

  it('shows kills, deaths, assists', () => {
    useMatchStore.getState().setMatchResult({
      placement: 3,
      kills: 7,
      deaths: 2,
      assists: 4,
      damage: 2000,
      legend: 'Wraith',
      map: 'World\'s Edge',
      mode: null,
    });

    render(<PostMatchSummary />);
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('shows damage', () => {
    useMatchStore.getState().setMatchResult({
      placement: 1,
      kills: 10,
      deaths: 0,
      assists: 5,
      damage: 3200,
      legend: 'Bangalore',
      map: 'Kings Canyon',
      mode: null,
    });

    render(<PostMatchSummary />);
    expect(screen.getByText('3.2K')).toBeDefined();
  });

  it('shows legend name', () => {
    useMatchStore.getState().setMatchResult({
      placement: 5,
      kills: 2,
      deaths: 1,
      assists: 1,
      damage: 800,
      legend: 'Pathfinder',
      map: 'Olympus',
      mode: null,
    });

    render(<PostMatchSummary />);
    expect(screen.getByText('Pathfinder')).toBeDefined();
  });

  it('shows coaching insights when available', () => {
    useMatchStore.getState().setMatchResult({
      placement: 3,
      kills: 4,
      deaths: 2,
      assists: 1,
      damage: 1200,
      legend: 'Horizon',
      map: 'Storm Point',
      mode: null,
    });
    useMatchStore.getState().addCoachingInsight({
      id: 1,
      matchId: 1,
      sessionId: 1,
      type: 'session_vs_average',
      ruleId: 'test',
      message: 'Great improvement in damage!',
      severity: 'achievement',
      dataJson: null,
      dismissed: false,
      createdAt: '2025-01-01T00:00:00Z',
    });

    render(<PostMatchSummary />);
    expect(screen.getByText('Great improvement in damage!')).toBeDefined();
  });

  it('shows comparison to personal averages', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 20,
      totalDeaths: 8,
      totalDamage: 6000,
      matchesPlayed: 4,
    });

    useMatchStore.getState().setMatchResult({
      placement: 2,
      kills: 8,
      deaths: 1,
      assists: 3,
      damage: 2200,
      legend: 'Wraith',
      map: 'World\'s Edge',
      mode: 'ranked',
    });

    render(<PostMatchSummary />);
    // Should show "vs avg" section
    expect(screen.getByText(/vs avg/i)).toBeDefined();
  });

  it('shows game mode when available', () => {
    useMatchStore.getState().setMatchResult({
      placement: 1,
      kills: 12,
      deaths: 0,
      assists: 4,
      damage: 3500,
      legend: 'Wraith',
      map: 'Storm Point',
      mode: 'ranked',
    });

    render(<PostMatchSummary />);
    // CSS text-transform: uppercase makes it display as "RANKED",
    // but DOM textContent is still "ranked"
    expect(screen.getByText('ranked')).toBeDefined();
  });

  it('hides game mode when unknown', () => {
    useMatchStore.getState().setMatchResult({
      placement: 1,
      kills: 5,
      deaths: 0,
      assists: 2,
      damage: 1800,
      legend: 'Horizon',
      map: 'Kings Canyon',
      mode: 'unknown',
    });

    render(<PostMatchSummary />);
    // "unknown" mode should not render (filtered out in JSX)
    const modeElements = screen.queryAllByText('unknown');
    expect(modeElements.length).toBe(0);
  });

  it('is wrapped in React.memo', () => {
    expect((PostMatchSummary as unknown as { $$typeof?: symbol }).$$typeof).toBeDefined();
  });
});
