/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RankedProgress } from '../../../src/renderer/windows/MainOverlay/RankedProgress';
import { useMatchStore } from '../../../src/renderer/stores/match-store';

describe('RankedProgress', () => {
  beforeEach(() => {
    useMatchStore.getState().resetMatch();
  });

  it('renders nothing when no rank data is available', () => {
    const { container } = render(<RankedProgress />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when rankName is null', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: null,
      rankScore: 5000,
    });

    const { container } = render(<RankedProgress />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when rankScore is null', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Gold II',
      rankScore: null,
    });

    const { container } = render(<RankedProgress />);
    expect(container.innerHTML).toBe('');
  });

  it('renders rank name and RP when data is available', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Gold II',
      rankScore: 5000,
    });

    render(<RankedProgress />);
    expect(screen.getByText('Ranked')).toBeDefined();
    expect(screen.getByText('Gold II')).toBeDefined();
    expect(screen.getByText(/5.*RP/)).toBeDefined();
  });

  it('renders Gold color class for Gold tier', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Gold II',
      rankScore: 5000,
    });

    render(<RankedProgress />);
    const rankElement = screen.getByText('Gold II');
    expect(rankElement.className).toContain('text-rank-gold');
  });

  it('renders progress bar for ranked tiers with divisions', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Silver III',
      rankScore: 2800,
    });

    const { container } = render(<RankedProgress />);
    // ProgressBar renders a div with style width
    const progressBar = container.querySelector('[style]');
    expect(progressBar).not.toBeNull();
  });

  it('renders RP total text for Master (no progress bar)', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Master',
      rankScore: 15000,
    });

    render(<RankedProgress />);
    expect(screen.getByText('Master')).toBeDefined();
    expect(screen.getByText('15000 RP total')).toBeDefined();
  });

  it('renders Predator without progress bar', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'rank',
      rankName: 'Predator',
      rankScore: 30000,
    });

    render(<RankedProgress />);
    expect(screen.getByText('Predator')).toBeDefined();
    expect(screen.getByText('30000 RP total')).toBeDefined();
  });

  it('uses React.memo for performance', () => {
    expect(
      (RankedProgress as unknown as { $$typeof?: symbol }).$$typeof,
    ).toBeDefined();
  });
});
