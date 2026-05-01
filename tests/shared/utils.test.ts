import { describe, it, expect } from 'vitest';
import { cleanLegendName, percentChange, formatCompact, kdRatio } from '../../src/shared/utils';

describe('cleanLegendName', () => {
  it('should strip #character_ prefix and _NAME suffix', () => {
    expect(cleanLegendName('#character_wraith_NAME')).toBe('Wraith');
  });

  it('should handle multi-word legend names with underscores', () => {
    expect(cleanLegendName('#character_mad_maggie_NAME')).toBe('Mad Maggie');
  });

  it('should capitalize each word correctly', () => {
    expect(cleanLegendName('#character_horizon_NAME')).toBe('Horizon');
    expect(cleanLegendName('#character_octane_NAME')).toBe('Octane');
    expect(cleanLegendName('#character_lifeline_NAME')).toBe('Lifeline');
    expect(cleanLegendName('#character_bangalore_NAME')).toBe('Bangalore');
  });

  it('should pass through already-clean names unchanged', () => {
    expect(cleanLegendName('Wraith')).toBe('Wraith');
    expect(cleanLegendName('Horizon')).toBe('Horizon');
    expect(cleanLegendName('Mad Maggie')).toBe('Mad Maggie');
  });

  it('should return "Unknown" for empty string', () => {
    expect(cleanLegendName('')).toBe('Unknown');
  });

  it('should return "Unknown" for null-like values', () => {
    // TypeScript guards against null, but runtime could get empty
    expect(cleanLegendName('')).toBe('Unknown');
  });

  it('should handle edge case with only prefix (no _NAME suffix)', () => {
    // If only prefix matches but no _NAME suffix, still strip prefix
    expect(cleanLegendName('#character_wraith')).toBe('Wraith');
  });

  it('should handle edge case with only _NAME suffix (no #character_ prefix)', () => {
    // If only suffix matches, strip suffix but don't alter capitalization
    expect(cleanLegendName('wraith_NAME')).toBe('wraith_NAME');
  });

  it('should handle all-caps localization key', () => {
    // Some versions might send uppercase
    expect(cleanLegendName('#character_WRAITH_NAME')).toBe('Wraith');
  });

  it('should handle three-word legend names', () => {
    expect(cleanLegendName('#character_alter_ego_NAME')).toBe('Alter Ego');
  });
});

// Verify existing utils still work (regression tests)
describe('existing utils regression', () => {
  it('percentChange handles zero previous', () => {
    expect(percentChange(5, 0)).toBe(100);
    expect(percentChange(0, 0)).toBe(0);
  });

  it('formatCompact handles various ranges', () => {
    expect(formatCompact(500)).toBe('500');
    expect(formatCompact(1500)).toBe('1.5K');
    expect(formatCompact(1_500_000)).toBe('1.5M');
  });

  it('kdRatio handles zero deaths', () => {
    expect(kdRatio(5, 0)).toBe('5.00');
    expect(kdRatio(0, 0)).toBe('0.00');
    expect(kdRatio(6, 3)).toBe('2.00');
  });
});
