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
    transparent: true,
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

    // Position main overlay in top-right
    if (windowName === 'main-overlay') {
      const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
      win.setPosition(screenWidth - 330, 10);
      win.show();
    }

    windows.set(windowName, win);
  }
}

export function getWindow(name: WindowName): BrowserWindow | undefined {
  return windows.get(name);
}

export function showWindow(name: WindowName): void {
  const win = windows.get(name);
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
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
