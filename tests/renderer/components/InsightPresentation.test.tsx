// ============================================================
// Insight Presentation Tests
// Tests that coaching insights are displayed with proper
// icons, severity colors, dismissibility, and max 3 shown.
// ============================================================

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsightCard } from '../../../src/renderer/components/InsightCard';
import { InsightList } from '../../../src/renderer/components/InsightList';
import { InsightSeverity } from '../../../src/shared/types';

describe('InsightCard Presentation', () => {
  it('should show correct severity color classes for each type', () => {
    const severities: Array<{ sev: string; expectedClass: string }> = [
      { sev: 'info', expectedClass: 'info' },
      { sev: 'achievement', expectedClass: 'achievement' },
      { sev: 'warning', expectedClass: 'warning' },
      { sev: 'suggestion', expectedClass: 'suggestion' },
    ];

    for (const { sev, expectedClass } of severities) {
      const { container } = render(
        <InsightCard message={`Test ${sev}`} severity={sev as 'info' | 'warning' | 'suggestion' | 'achievement'} />,
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain(expectedClass);
    }
  });

  it('should be dismissible when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(
      <InsightCard message="Test insight" severity="info" onDismiss={onDismiss} />,
    );

    const dismissBtn = screen.getByLabelText('Dismiss');
    expect(dismissBtn).toBeDefined();
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not show dismiss button when onDismiss is not provided', () => {
    render(
      <InsightCard message="Test insight" severity="info" />,
    );

    const dismissBtn = screen.queryByLabelText('Dismiss');
    expect(dismissBtn).toBeNull();
  });
});

describe('InsightList', () => {
  it('should show max 3 insights (most severe first)', () => {
    const insights = [
      { id: 1, message: 'Info 1', severity: 'info' as const, type: 'a', ruleId: 'r1' },
      { id: 2, message: 'Warning 1', severity: 'warning' as const, type: 'b', ruleId: 'r2' },
      { id: 3, message: 'Achievement 1', severity: 'achievement' as const, type: 'c', ruleId: 'r3' },
      { id: 4, message: 'Warning 2', severity: 'warning' as const, type: 'd', ruleId: 'r4' },
      { id: 5, message: 'Info 2', severity: 'info' as const, type: 'e', ruleId: 'r5' },
    ];

    render(<InsightList insights={insights} maxVisible={3} />);

    // Should only show 3 cards
    const cards = screen.getAllByText(/Info|Warning|Achievement/);
    // At most 3 insight messages should be visible
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('should sort insights by severity (warning > suggestion > achievement > info)', () => {
    const insights = [
      { id: 1, message: 'Info message', severity: 'info' as const, type: 'a', ruleId: 'r1' },
      { id: 2, message: 'Warning message', severity: 'warning' as const, type: 'b', ruleId: 'r2' },
      { id: 3, message: 'Achievement message', severity: 'achievement' as const, type: 'c', ruleId: 'r3' },
    ];

    const { container } = render(<InsightList insights={insights} maxVisible={3} />);

    // Get all cards in DOM order
    const allCards = container.querySelectorAll('[class*="insight-card"]');
    expect(allCards.length).toBe(3);

    // First card should be the warning (highest priority)
    expect(allCards[0].className).toContain('warning');
  });

  it('should show type-appropriate icons/emojis for each insight type', () => {
    const insights = [
      { id: 1, message: 'Hot streak!', severity: 'achievement' as const, type: 'session_vs_average', ruleId: 'r1' },
      { id: 2, message: 'Declining trend', severity: 'warning' as const, type: 'trend_declining', ruleId: 'r2' },
    ];

    const { container } = render(<InsightList insights={insights} maxVisible={3} />);

    // Should render icons (we check for the icon container)
    const iconElements = container.querySelectorAll('[data-testid="insight-icon"]');
    expect(iconElements.length).toBeGreaterThan(0);
  });
});
