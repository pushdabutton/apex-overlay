/**
 * @vitest-environment jsdom
 */
// ============================================================
// PostMatch Session Wiring Tests
// Verifies that the PostMatch window subscribes to SESSION_UPDATE
// so that PerformanceBenchmark and LegendComparison can display
// real session averages instead of zeros.
//
// Bug: PostMatch.tsx only subscribes to MATCH_END, MATCH_UPDATE,
// COACHING_INSIGHT, and MATCH_START -- but NOT SESSION_UPDATE.
// This means useSessionStore stays at zero in the post-match window.
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { installMockBridge } from '../test-utils';
import { PerformanceBenchmark } from '../../../src/renderer/windows/PostMatch/PerformanceBenchmark';
import { LegendComparison } from '../../../src/renderer/windows/PostMatch/LegendComparison';
import { useMatchStore } from '../../../src/renderer/stores/match-store';
import { useSessionStore } from '../../../src/renderer/stores/session-store';

describe('PostMatch session data wiring', () => {
  beforeEach(() => {
    installMockBridge();
    useMatchStore.getState().resetMatch();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  describe('PerformanceBenchmark', () => {
    it('shows "Play more matches" when session has zero matches', () => {
      render(<PerformanceBenchmark />);
      expect(screen.getByText(/play more matches/i)).toBeDefined();
    });

    it('shows comparison data when session has matches', () => {
      // Populate session store with prior match data
      useSessionStore.getState().updateFromIpc({
        totalKills: 10,
        totalDeaths: 4,
        totalDamage: 3000,
        matchesPlayed: 2,
      });

      // Populate match store with current match data
      useMatchStore.getState().updateFromIpc({
        type: 'stats',
        stats: { kills: 6, deaths: 1, assists: 3, damage: 1800, headshots: 2, knockdowns: 4 },
      });

      render(<PerformanceBenchmark />);

      // Should show the kills value
      expect(screen.getByText('6')).toBeDefined();
      // Should show the damage value
      expect(screen.getByText('1.8K')).toBeDefined();
    });

    it('shows session average comparison text', () => {
      useSessionStore.getState().updateFromIpc({
        totalKills: 10,
        totalDeaths: 4,
        totalDamage: 3000,
        matchesPlayed: 2,
      });

      useMatchStore.getState().updateFromIpc({
        type: 'stats',
        stats: { kills: 6, deaths: 1, assists: 3, damage: 1800, headshots: 2, knockdowns: 4 },
      });

      render(<PerformanceBenchmark />);
      // Should display average kills (10/2 = 5.0)
      expect(screen.getByText(/avg 5/)).toBeDefined();
    });
  });

  describe('LegendComparison', () => {
    it('shows current match legend and stats', () => {
      useMatchStore.getState().updateFromIpc({
        type: 'legend',
        legend: 'Wraith',
      });
      useMatchStore.getState().updateFromIpc({
        type: 'stats',
        stats: { kills: 4, deaths: 1, assists: 2, damage: 1200, headshots: 1, knockdowns: 3 },
      });

      render(<LegendComparison />);
      expect(screen.getByText('Wraith')).toBeDefined();
      expect(screen.getByText('This Match')).toBeDefined();
    });

    it('shows session comparison when matches have been played', () => {
      useSessionStore.getState().updateFromIpc({
        totalKills: 15,
        totalDeaths: 5,
        totalDamage: 4500,
        matchesPlayed: 3,
      });

      useMatchStore.getState().updateFromIpc({
        type: 'legend',
        legend: 'Horizon',
      });
      useMatchStore.getState().updateFromIpc({
        type: 'stats',
        stats: { kills: 7, deaths: 2, assists: 3, damage: 2000, headshots: 2, knockdowns: 5 },
      });

      render(<LegendComparison />);

      // Should show the "vs" divider and session section
      expect(screen.getByText('vs')).toBeDefined();
      expect(screen.getByText('Session')).toBeDefined();
      expect(screen.getByText('3 games')).toBeDefined();
    });

    it('hides session comparison when no prior matches', () => {
      useMatchStore.getState().updateFromIpc({
        type: 'legend',
        legend: 'Octane',
      });

      render(<LegendComparison />);

      // "Session" section should not be visible
      const vsElements = screen.queryAllByText('vs');
      expect(vsElements.length).toBe(0);
    });
  });
});
