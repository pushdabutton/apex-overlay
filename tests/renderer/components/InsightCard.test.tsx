/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InsightCard } from '../../../src/renderer/components/InsightCard';

describe('InsightCard', () => {
  it('renders message text', () => {
    render(
      <InsightCard
        message="Your headshot rate dropped 5%"
        severity="warning"
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('Your headshot rate dropped 5%')).toBeDefined();
  });

  it('renders with warning severity styling', () => {
    const { container } = render(
      <InsightCard
        message="Tip: rotate faster"
        severity="warning"
        onDismiss={() => {}}
      />
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('warning');
  });

  it('renders with info severity styling', () => {
    const { container } = render(
      <InsightCard
        message="Map rotation in 5 min"
        severity="info"
        onDismiss={() => {}}
      />
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('info');
  });

  it('renders with suggestion severity styling', () => {
    const { container } = render(
      <InsightCard
        message="Consider switching legends"
        severity="suggestion"
        onDismiss={() => {}}
      />
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('suggestion');
  });

  it('renders with achievement severity styling', () => {
    const { container } = render(
      <InsightCard
        message="New personal best!"
        severity="achievement"
        onDismiss={() => {}}
      />
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('achievement');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <InsightCard
        message="Test insight"
        severity="info"
        onDismiss={onDismiss}
      />
    );

    const dismissBtn = screen.getByRole('button');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('is wrapped in React.memo for performance', () => {
    expect((InsightCard as unknown as { $$typeof?: symbol }).$$typeof).toBeDefined();
  });
});
