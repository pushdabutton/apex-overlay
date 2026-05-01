// ============================================================
// GEP Provider Factory -- Toggles between real ow-electron GEP
// and the MockGEP based on runtime detection + env override.
//
// Detection order:
//   1. USE_MOCK_GEP=true env var  -> MockGEP (always)
//   2. app.overwolf exists        -> Real ow-electron GEP
//   3. Fallback                   -> MockGEP (standard Electron)
//
// The ow-electron GEP API is completely different from ow-native:
//   - Access via app.overwolf.packages.gep (NOT require())
//   - Must wait for app.overwolf.packages.on('ready')
//   - Events: gep.on('new-game-event', (e, gameId, ...) => ...)
//   - Info:   gep.on('new-info-update', (e, gameId, ...) => ...)
//
// OwElectronGEPAdapter wraps this API into the GEPProvider
// interface that GEPManager consumes, so GEPManager stays
// unchanged regardless of which provider is active.
// ============================================================

import { app } from 'electron';
import type { GEPProvider } from './gep-manager';
import { MockGEP } from './mock-gep';
import { OwElectronGEPAdapter } from './ow-electron-adapter';

/**
 * Create the appropriate GEP provider based on environment.
 *
 * - USE_MOCK_GEP=true           -> MockGEP (development, testing)
 * - Running in ow-electron      -> Real GEP via adapter
 * - Otherwise (standard Electron) -> MockGEP fallback
 */
export function createGEPProvider(): GEPProvider {
  if (process.env.USE_MOCK_GEP === 'true') {
    console.log('[GEP Factory] USE_MOCK_GEP=true -> MockGEP');
    const mock = new MockGEP();
    return mock.asProvider();
  }

  // Check if we are running inside ow-electron by probing for the
  // Overwolf extension on the app object. In standard Electron this
  // property does not exist.
  const owApp = app as typeof app & {
    overwolf?: {
      packages: {
        gep: unknown;
        on(event: 'ready', handler: () => void): void;
      };
    };
  };

  if (owApp.overwolf) {
    console.log('[GEP Factory] ow-electron detected -> waiting for GEP package ready');
    return createOwElectronProvider(owApp.overwolf.packages);
  }

  // Not running in ow-electron -- fall back to mock
  console.warn('[GEP Factory] Standard Electron detected (no app.overwolf), falling back to MockGEP');
  const mock = new MockGEP();
  return mock.asProvider();
}

/**
 * Create an async-initialized GEP provider that waits for the
 * ow-electron packages 'ready' event before accessing `gep`.
 *
 * Because GEPManager.initialize() is async and retries feature
 * registration, we can return the adapter immediately -- the
 * ready event will fire before or during the first
 * setRequiredFeatures call. If it hasn't fired yet, the adapter's
 * setRequiredFeatures will fail and GEPManager's retry logic
 * handles it gracefully.
 */
function createOwElectronProvider(packages: {
  gep: unknown;
  on(event: 'ready', handler: (e: unknown, packageName: string, version: string) => void): void;
}): GEPProvider {
  // The GEP package is NOT available until the 'ready' event fires.
  // We return a deferred provider that queues calls until gep is ready,
  // then replays them.
  let realProvider: GEPProvider | null = null;
  const pendingFeatureCalls: Array<{ features: string[]; resolve: (v: unknown) => void }> = [];
  const pendingEventListeners: Array<(payload: { events: Array<{ name: string; data: string }> }) => void> = [];
  const pendingInfoListeners: Array<(payload: { info: Record<string, unknown> }) => void> = [];

  packages.on('ready', (_e: unknown, packageName: string, _version: string) => {
    if (packageName !== 'gep') return;
    console.log('[GEP Factory] GEP package ready — creating adapter');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new OwElectronGEPAdapter(packages.gep as any);
    realProvider = adapter.asProvider();

    // Replay any queued operations
    for (const call of pendingFeatureCalls) {
      realProvider.setRequiredFeatures(call.features).then(call.resolve);
    }
    for (const cb of pendingEventListeners) {
      realProvider.onNewEvents.addListener(cb);
    }
    for (const cb of pendingInfoListeners) {
      realProvider.onInfoUpdates2.addListener(cb);
    }
    pendingFeatureCalls.length = 0;
    pendingEventListeners.length = 0;
    pendingInfoListeners.length = 0;
  });

  // Return a proxy provider that either forwards to the real one
  // or queues operations until ready
  return {
    setRequiredFeatures: async (features: string[]) => {
      if (realProvider) return realProvider.setRequiredFeatures(features);
      return new Promise((resolve) => {
        pendingFeatureCalls.push({ features, resolve });
      });
    },
    getInfo: async () => {
      if (realProvider?.getInfo) return realProvider.getInfo();
      return null;
    },
    onNewEvents: {
      addListener: (cb) => {
        if (realProvider) { realProvider.onNewEvents.addListener(cb); return; }
        pendingEventListeners.push(cb);
      },
      removeListener: (cb) => {
        if (realProvider) { realProvider.onNewEvents.removeListener(cb); return; }
        const idx = pendingEventListeners.indexOf(cb);
        if (idx >= 0) pendingEventListeners.splice(idx, 1);
      },
    },
    onInfoUpdates2: {
      addListener: (cb) => {
        if (realProvider) { realProvider.onInfoUpdates2.addListener(cb); return; }
        pendingInfoListeners.push(cb);
      },
      removeListener: (cb) => {
        if (realProvider) { realProvider.onInfoUpdates2.removeListener(cb); return; }
        const idx = pendingInfoListeners.indexOf(cb);
        if (idx >= 0) pendingInfoListeners.splice(idx, 1);
      },
    },
  };
}
