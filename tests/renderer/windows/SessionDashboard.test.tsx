/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { installMockBridge } from '../test-utils';
import { SessionDashboardView } from '../../../src/renderer/windows/SessionDashboard/SessionDashboardView';
import { useSessionStore } from '../../../src/renderer/stores/session-store';

describe('SessionDashboardView', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    useSessionStore.getState().resetSession();
    bridge.mock.invoke.mockResolvedValue([]);
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('shows session stats summary', async () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 25,
      totalDeaths: 10,
      totalDamage: 8000,
      matchesPlayed: 5,
      totalAssists: 12,
      totalHeadshots: 8,
    });

    render(<SessionDashboardView />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeDefined();
      expect(screen.getByText('8.0K')).toBeDefined();
    });
  });

  it('handles empty state with no matches', async () => {
    // matchesPlayed must remain 0 for empty state
    render(<SessionDashboardView />);

    await waitFor(() => {
      expect(screen.getByText(/no matches yet/i)).toBeDefined();
    });
  });

  it('shows match history list when matches exist', async () => {
    bridge.mock.invoke.mockResolvedValue([
      {
        id: 1,
        legend: 'Horizon',
        kills: 5,
        deaths: 1,
        damage: 1500,
        placement: 2,
        map: 'Storm Point',
        startedAt: '2025-01-01T10:00:00Z',
      },
      {
        id: 2,
        legend: 'Wraith',
        kills: 3,
        deaths: 1,
        damage: 900,
        placement: 5,
        map: 'World\'s Edge',
        startedAt: '2025-01-01T09:00:00Z',
      },
    ]);

    useSessionStore.getState().updateFromIpc({
      totalKills: 8,
      totalDeaths: 2,
      totalDamage: 2400,
      matchesPlayed: 2,
    });

    render(<SessionDashboardView />);

    await waitFor(() => {
      expect(screen.getAllByText('Horizon').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wraith').length).toBeGreaterThan(0);
    });
  });

  it('shows legend breakdown from match history', async () => {
    bridge.mock.invoke.mockResolvedValue([
      { id: 1, legend: 'Horizon', kills: 5, deaths: 1, damage: 1500, placement: 2, map: 'SP' },
      { id: 2, legend: 'Horizon', kills: 3, deaths: 2, damage: 1000, placement: 4, map: 'SP' },
      { id: 3, legend: 'Wraith', kills: 7, deaths: 0, damage: 2100, placement: 1, map: 'WE' },
    ]);

    useSessionStore.getState().updateFromIpc({
      totalKills: 15,
      totalDeaths: 3,
      totalDamage: 4600,
      matchesPlayed: 3,
    });

    render(<SessionDashboardView />);

    await waitFor(() => {
      // Should show legend section
      expect(screen.getByText(/legend/i)).toBeDefined();
    });
  });

  it('is wrapped in React.memo', () => {
    expect((SessionDashboardView as unknown as { $$typeof?: symbol }).$$typeof).toBeDefined();
  });
});
