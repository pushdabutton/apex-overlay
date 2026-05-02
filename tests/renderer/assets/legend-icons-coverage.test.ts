// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { LEGENDS } from '../../../src/shared/constants';

const LEGENDS_DIR = resolve(__dirname, '../../../src/renderer/assets/legends');

/**
 * Converts a legend display name (e.g. "Mad Maggie") to the expected
 * SVG filename on disk (e.g. "mad-maggie.svg").
 */
function legendToFilename(legend: string): string {
  return legend.toLowerCase().replace(/\s+/g, '-') + '.svg';
}

describe('Legend icon SVG coverage', () => {
  it('has an SVG file for every legend in LEGENDS constant', () => {
    const missing: string[] = [];
    for (const legend of LEGENDS) {
      const filename = legendToFilename(legend);
      const filepath = resolve(LEGENDS_DIR, filename);
      if (!existsSync(filepath)) {
        missing.push(`${legend} -> ${filename}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('all SVG files are non-empty', () => {
    const { readdirSync, statSync } = require('fs');
    const svgFiles: string[] = readdirSync(LEGENDS_DIR).filter(
      (f: string) => f.endsWith('.svg'),
    );
    const empty: string[] = [];
    for (const file of svgFiles) {
      const stat = statSync(resolve(LEGENDS_DIR, file));
      if (stat.size === 0) {
        empty.push(file);
      }
    }
    expect(empty).toEqual([]);
  });

  it('all SVG files contain valid SVG content (start with <?xml or <svg)', () => {
    const { readdirSync, readFileSync } = require('fs');
    const svgFiles: string[] = readdirSync(LEGENDS_DIR).filter(
      (f: string) => f.endsWith('.svg'),
    );
    const invalid: string[] = [];
    for (const file of svgFiles) {
      const content = readFileSync(resolve(LEGENDS_DIR, file), 'utf-8').trimStart();
      if (!content.startsWith('<?xml') && !content.startsWith('<svg')) {
        invalid.push(file);
      }
    }
    expect(invalid).toEqual([]);
  });

  it('LEGENDS includes Sparrow', () => {
    expect(LEGENDS).toContain('Sparrow');
  });

  it('LEGENDS count matches number of SVG files', () => {
    const { readdirSync } = require('fs');
    const svgFiles: string[] = readdirSync(LEGENDS_DIR).filter(
      (f: string) => f.endsWith('.svg'),
    );
    expect(svgFiles.length).toBe(LEGENDS.length);
  });
});
