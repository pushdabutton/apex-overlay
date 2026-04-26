import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    globals: true,
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    exclude: ['node_modules', 'dist'],
    // Default environment for main process tests
    environment: 'node',
    // Per-file environment overrides via @vitest-environment jsdom comment
    environmentMatchGlobs: [
      ['tests/renderer/**', 'jsdom'],
      ['src/renderer/**', 'jsdom'],
    ],
  },
});
