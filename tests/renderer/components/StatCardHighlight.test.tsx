/**
 * @vitest-environment jsdom
 */
// ============================================================
// StatCard Highlight Tests
// Tests for the enhanced StatCard with a `highlight` prop that
// creates visual emphasis for primary stats (kills, damage).
// ============================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatCard } from '../../../src/renderer/components/StatCard';

describe('StatCard highlight styling', () => {
  it('renders with highlight styling when highlight prop is true', () => {
    const { container } = render(
      <StatCard label="Kills" value={8} highlight />
    );
    const card = container.firstElementChild;
    // Highlight cards should have a distinctive accent border
    expect(card?.className).toContain('border-apex-gold');
  });

  it('renders without highlight styling by default', () => {
    const { container } = render(
      <StatCard label="Deaths" value={3} />
    );
    const card = container.firstElementChild;
    // Non-highlight cards should not have the gold border
    expect(card?.className).not.toContain('border-apex-gold');
  });

  it('renders highlight with larger value text', () => {
    const { container } = render(
      <StatCard label="Kills" value={12} highlight />
    );
    // Highlight mode should use larger text for the value
    const valueEl = container.querySelector('.overlay-value-highlight');
    expect(valueEl).toBeDefined();
    expect(valueEl?.textContent).toBe('12');
  });

  it('renders non-highlight value with standard text', () => {
    const { container } = render(
      <StatCard label="Deaths" value={2} />
    );
    // Standard mode should NOT have the highlight value class
    const valueEl = container.querySelector('.overlay-value-highlight');
    expect(valueEl).toBeNull();
  });

  it('highlight with previousValue still shows trend indicator', () => {
    const { container } = render(
      <StatCard label="Kills" value={10} previousValue={5} highlight />
    );
    // Should show the up arrow trend
    expect(container.textContent).toContain('\u2191');
  });

  it('highlight in compact mode uses appropriate sizing', () => {
    const { container } = render(
      <StatCard label="Kills" value={6} highlight compact />
    );
    const card = container.firstElementChild;
    // Compact highlight should still have gold border but compact padding
    expect(card?.className).toContain('border-apex-gold');
    expect(card?.className).toContain('p-2');
  });
});
