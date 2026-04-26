// ============================================================
// GEP Provider Factory -- Toggles between real Overwolf GEP
// and the MockGEP based on USE_MOCK_GEP environment variable.
// ============================================================

import type { GEPProvider } from './gep-manager';
import { MockGEP } from './mock-gep';

/**
 * Create the appropriate GEP provider based on environment.
 *
 * - USE_MOCK_GEP=true  -> MockGEP (development, testing)
 * - Otherwise           -> Real Overwolf GEP (production)
 *
 * In production, this returns the real Overwolf GEP API object.
 * Since the Overwolf SDK is only available at runtime inside
 * ow-electron, we lazy-require it and fall back to mock.
 */
export function createGEPProvider(): GEPProvider {
  if (process.env.USE_MOCK_GEP === 'true') {
    const mock = new MockGEP();
    return mock.asProvider();
  }

  // Attempt to load real Overwolf GEP
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { overwolf } = require('@aspect-build/aspect-overwolf-electron');
    return overwolf.games.events as GEPProvider;
  } catch {
    // Not running inside ow-electron -- fall back to mock
    console.warn('[GEP Factory] Overwolf SDK not available, falling back to MockGEP');
    const mock = new MockGEP();
    return mock.asProvider();
  }
}
