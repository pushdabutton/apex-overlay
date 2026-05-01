// ============================================================
// Window Manager -- Creates and manages overlay windows
// ============================================================

import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

type WindowName = 'main-overlay' | 'post-match' | 'session-dashboard' | 'settings';

const windows = new Map<WindowName, BrowserWindow>();

const WINDOW_CONFIGS: Record<WindowName, Electron.BrowserWindowConstructorOptions> = {
  'main-overlay': {
    width: 320,
    height: 480,
    minWidth: 280,
    minHeight: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  'post-match': {
    width: 600,
    height: 700,
    transparent: false,
    backgroundColor: '#0f0f19',
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  'session-dashboard': {
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  settings: {
    width: 500,
    height: 600,
    transparent: false,
    frame: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
};

export async function createWindows(): Promise<void> {
  for (const [name, config] of Object.entries(WINDOW_CONFIGS)) {
    const win = new BrowserWindow(config);
    const windowName = name as WindowName;

    // Load renderer with window identifier as query param
    if (process.env.NODE_ENV === 'development') {
      await win.loadURL(`http://localhost:5173?window=${windowName}`);
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { window: windowName },
      });
    }

    // Position main overlay at center-right of screen
    // (avoids overlapping mini-map, kill feed, and inventory in top-right)
    if (windowName === 'main-overlay') {
      const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
      const windowWidth = 320;
      const windowHeight = 480;
      const x = screenWidth - windowWidth - 10; // 10px from right edge
      const y = Math.round((screenHeight - windowHeight) / 2); // vertically centered
      win.setPosition(x, y);
      win.show();
    }

    windows.set(windowName, win);
  }
}

export function getWindow(name: WindowName): BrowserWindow | undefined {
  return windows.get(name);
}

// Overlay windows (main-overlay) are focusable: false — never call win.focus() on them
// as it would steal focus from the game and cause the overlay to disappear.
const NON_FOCUSABLE_WINDOWS: WindowName[] = ['main-overlay'];

export function showWindow(name: WindowName): void {
  const win = windows.get(name);
  if (win && !win.isDestroyed()) {
    win.show();
    if (!NON_FOCUSABLE_WINDOWS.includes(name)) {
      win.focus();
    }
  }
}

export function hideWindow(name: WindowName): void {
  const win = windows.get(name);
  if (win && !win.isDestroyed()) {
    win.hide();
  }
}

export function broadcastToAll(channel: string, data: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}
