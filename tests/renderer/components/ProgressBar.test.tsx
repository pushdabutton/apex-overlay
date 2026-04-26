/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProgressBar } from '../../../src/renderer/components/ProgressBar';

describe('ProgressBar', () => {
  it('renders with percentage width', () => {
    const { container } = render(
      <ProgressBar percent={65} color="blue" />
    );
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('width: 65%');
  });

  it('renders with label when provided', () => {
    render(<ProgressBar percent={50} color="green" label="Progress" />);
    expect(screen.getByText('Progress')).toBeDefined();
    expect(screen.getByText('50%')).toBeDefined();
  });

  it('clamps percentage to 0-100', () => {
    const { container } = render(
      <ProgressBar percent={150} color="red" />
    );
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('width: 100%');
  });

  it('clamps negative percentage to 0', () => {
    const { container } = render(
      <ProgressBar percent={-10} color="blue" />
    );
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('width: 0%');
  });

  it('applies correct color class', () => {
    const { container } = render(
      <ProgressBar percent={50} color="gold" />
    );
    const bar = container.querySelector('[style]');
    expect(bar?.className).toContain('bg-apex-gold');
  });

  it('defaults to blue when no color specified', () => {
    const { container } = render(
      <ProgressBar percent={50} />
    );
    const bar = container.querySelector('[style]');
    expect(bar?.className).toContain('bg-apex-blue');
  });

  it('is wrapped in React.memo for performance', () => {
    expect((ProgressBar as unknown as { $$typeof?: symbol }).$$typeof).toBeDefined();
  });
});
