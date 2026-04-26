/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { installMockBridge } from '../test-utils';
import { MainOverlayHUD } from '../../../src/renderer/windows/MainOverlay/MainOverlayHUD';
import { useSessionStore } from '../../../src/renderer/stores/session-store';

describe('MainOverlayHUD', () => {
  let bridge: ReturnType<typeof installMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).apexCoach;
  });

  it('renders session K/D', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 10,
      totalDeaths: 4,
      matchesPlayed: 2,
      totalDamage: 2000,
    });

    render(<MainOverlayHUD />);
    expect(screen.getByText('K/D')).toBeDefined();
    expect(screen.getByText('2.50')).toBeDefined();
  });

  it('renders total kills', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 15,
      totalDeaths: 3,
      matchesPlayed: 3,
      totalDamage: 3000,
    });

    render(<MainOverlayHUD />);
    expect(screen.getByText('Kills')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
  });

  it('renders total damage', () => {
    useSessionStore.getState().updateFromIpc({
      totalKills: 5,
      totalDeaths: 2,
      matchesPlayed: 1,
      totalDamage: 2500,
    });

    render(<MainOverlayHUD />);
    expect(screen.getByText('Damage')).toBeDefined();
    expect(screen.getByText('2.5K')).toBeDefined();
  });

  it('has fixed dimensions and no overflow', () => {
    const { container } = render(<MainOverlayHUD />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeDefined();
    // Should have a fixed width class or style
    expect(root.className).toContain('w-');
    expect(root.className).toContain('overflow-hidden');
  });

  it('is wrapped in React.memo for performance', () => {
    expect((MainOverlayHUD as unknown as { $$typeof?: symbol }).$$typeof).toBeDefined();
  });
});
