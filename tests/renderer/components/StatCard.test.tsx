/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatCard } from '../../../src/renderer/components/StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="K/D" value="2.5" />);
    expect(screen.getByText('K/D')).toBeDefined();
    expect(screen.getByText('2.5')).toBeDefined();
  });

  it('renders numeric values with formatCompact', () => {
    render(<StatCard label="Damage" value={1500} />);
    expect(screen.getByText('Damage')).toBeDefined();
    expect(screen.getByText('1.5K')).toBeDefined();
  });

  it('renders small numeric values without suffix', () => {
    render(<StatCard label="Kills" value={8} />);
    expect(screen.getByText('8')).toBeDefined();
  });

  it('shows trend indicator when previousValue is provided', () => {
    const { container } = render(
      <StatCard label="Kills" value={10} previousValue={5} />
    );
    // TrendIndicator shows an arrow when values differ
    expect(container.textContent).toContain('\u2191'); // up arrow
  });

  it('renders in compact mode with smaller styling', () => {
    const { container } = render(
      <StatCard label="K/D" value="2.5" compact />
    );
    // Compact mode uses p-2 class
    const card = container.firstElementChild;
    expect(card?.className).toContain('p-2');
  });

  it('is wrapped in React.memo for performance', () => {
    // StatCard should be a memoized component
    expect((StatCard as unknown as { $$typeof?: symbol }).$$typeof).toBeDefined();
  });
});
