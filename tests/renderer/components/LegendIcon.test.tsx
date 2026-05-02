/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock the legends icon index so we control which legends have icons
vi.mock('../../../src/renderer/assets/legends', () => {
  const iconMap: Record<string, string> = {
    wraith: '/assets/wraith.svg',
    bloodhound: '/assets/bloodhound.svg',
    'mad maggie': '/assets/mad-maggie.svg',
  };
  return {
    legendIconUrl: (name: string) => iconMap[name.toLowerCase()],
  };
});

import { LegendIcon } from '../../../src/renderer/components/LegendIcon';

describe('LegendIcon', () => {
  describe('SVG rendering', () => {
    it('renders an img element when SVG is available', () => {
      render(<LegendIcon legend="Wraith" />);
      const img = screen.getByRole('img', { name: 'Wraith' });
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toBe('/assets/wraith.svg');
    });

    it('sets alt text to legend name', () => {
      render(<LegendIcon legend="Bloodhound" />);
      const img = screen.getByRole('img', { name: 'Bloodhound' });
      expect(img.getAttribute('alt')).toBe('Bloodhound');
    });

    it('handles legend names with spaces (Mad Maggie)', () => {
      render(<LegendIcon legend="Mad Maggie" />);
      const img = screen.getByRole('img', { name: 'Mad Maggie' });
      expect(img.getAttribute('src')).toBe('/assets/mad-maggie.svg');
    });

    it('is case-insensitive for legend name lookup', () => {
      render(<LegendIcon legend="WRAITH" />);
      const img = screen.getByRole('img', { name: 'WRAITH' });
      expect(img).toBeDefined();
    });

    it('img is not draggable', () => {
      render(<LegendIcon legend="Wraith" />);
      const img = screen.getByRole('img', { name: 'Wraith' });
      expect(img.getAttribute('draggable')).toBe('false');
    });
  });

  describe('fallback rendering', () => {
    it('renders initials when no SVG is available', () => {
      render(<LegendIcon legend="FutureLegend" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('F')).toBeDefined();
    });

    it('renders two-letter initials for multi-word unknown legend', () => {
      render(<LegendIcon legend="New Legend" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('NL')).toBeDefined();
    });
  });

  describe('sizing', () => {
    it('defaults to small size', () => {
      const { container } = render(<LegendIcon legend="Wraith" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.className).toContain('w-6');
      expect(wrapper.className).toContain('h-6');
    });

    it('applies medium size class', () => {
      const { container } = render(<LegendIcon legend="Wraith" size="md" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.className).toContain('w-10');
      expect(wrapper.className).toContain('h-10');
    });

    it('applies large size class', () => {
      const { container } = render(<LegendIcon legend="Wraith" size="lg" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.className).toContain('w-14');
      expect(wrapper.className).toContain('h-14');
    });
  });

  describe('container styling', () => {
    it('has circular styling with overflow hidden when SVG is present', () => {
      const { container } = render(<LegendIcon legend="Wraith" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.className).toContain('rounded-full');
      expect(wrapper.className).toContain('overflow-hidden');
    });

    it('has circular styling in fallback mode', () => {
      const { container } = render(<LegendIcon legend="Unknown" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.className).toContain('rounded-full');
    });

    it('sets title attribute to legend name', () => {
      const { container } = render(<LegendIcon legend="Wraith" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.getAttribute('title')).toBe('Wraith');
    });

    it('sets title attribute in fallback mode', () => {
      const { container } = render(<LegendIcon legend="Unknown" />);
      const wrapper = container.firstElementChild!;
      expect(wrapper.getAttribute('title')).toBe('Unknown');
    });
  });

  describe('memoization', () => {
    it('is wrapped in React.memo', () => {
      // React.memo wraps the component, setting $$typeof to Symbol.for('react.memo')
      expect((LegendIcon as unknown as { $$typeof: symbol }).$$typeof).toBe(
        Symbol.for('react.memo'),
      );
    });
  });
});
