/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { WeaponTracker } from '../../../src/renderer/windows/MainOverlay/WeaponTracker';
import { useMatchStore } from '../../../src/renderer/stores/match-store';

describe('WeaponTracker', () => {
  beforeEach(() => {
    useMatchStore.getState().resetMatch();
  });

  it('renders nothing when no weapons data is available', () => {
    const { container } = render(<WeaponTracker />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when weapons object is empty', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: {},
    });

    const { container } = render(<WeaponTracker />);
    expect(container.innerHTML).toBe('');
  });

  it('renders weapon names when weapons data is available', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'R-301 Carbine', weapon1: 'Peacekeeper' },
    });

    render(<WeaponTracker />);
    expect(screen.getByText('Weapons')).toBeDefined();
    expect(screen.getByText('R-301 Carbine')).toBeDefined();
    expect(screen.getByText('Peacekeeper')).toBeDefined();
  });

  it('renders one weapon and empty slot when only weapon0 is set', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'Wingman' },
    });

    render(<WeaponTracker />);
    expect(screen.getByText('Wingman')).toBeDefined();
    expect(screen.getByText('Slot 2')).toBeDefined();
  });

  it('renders one weapon and empty slot when only weapon1 is set', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon1: 'R-99' },
    });

    render(<WeaponTracker />);
    expect(screen.getByText('R-99')).toBeDefined();
    expect(screen.getByText('Slot 1')).toBeDefined();
  });

  it('updates when weapons change', () => {
    useMatchStore.getState().updateFromIpc({
      type: 'weapons',
      weapons: { weapon0: 'R-301 Carbine', weapon1: 'Peacekeeper' },
    });

    const { rerender } = render(<WeaponTracker />);
    expect(screen.getByText('R-301 Carbine')).toBeDefined();

    // Simulate weapon swap
    act(() => {
      useMatchStore.getState().updateFromIpc({
        type: 'weapons',
        weapons: { weapon0: 'Flatline', weapon1: 'Mastiff' },
      });
    });

    rerender(<WeaponTracker />);
    expect(screen.getByText('Flatline')).toBeDefined();
    expect(screen.getByText('Mastiff')).toBeDefined();
  });

  it('uses React.memo for performance', () => {
    expect(
      (WeaponTracker as unknown as { $$typeof?: symbol }).$$typeof,
    ).toBeDefined();
  });
});
