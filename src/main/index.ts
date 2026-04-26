// ============================================================
// Main Process Entry Point
// Initializes: windows, GEP, database, coaching engine, API
// ============================================================

import { app, BrowserWindow } from 'electron';
import { createWindows, getWindow } from './windows';
import { registerIpcHandlers } from './ipc-handlers';
import { GEPManager } from './gep/gep-manager';
import { initializeDatabase } from './db/database';
import { CoachingEngine } from './coaching/engine';
import { MozambiqueClient } from './api/mozambique-client';
import { ApiScheduler } from './api/api-scheduler';

let gepManager: GEPManager;
let coachingEngine: CoachingEngine;
let apiScheduler: ApiScheduler;

async function bootstrap(): Promise<void> {
  // 1. Initialize SQLite database and run migrations
  const db = initializeDatabase();

  // 2. Create coaching engine
  coachingEngine = new CoachingEngine(db);

  // 3. Create API client and scheduler
  const apiClient = new MozambiqueClient(db);
  apiScheduler = new ApiScheduler(apiClient, db);

  // 4. Create overlay windows
  await createWindows();

  // 5. Register IPC handlers (renderer <-> main communication)
  registerIpcHandlers(db, coachingEngine);

  // 6. Initialize GEP (Game Event Provider)
  gepManager = new GEPManager(db, coachingEngine);
  await gepManager.initialize();

  // 7. Start API polling
  await apiScheduler.start();
}

// App lifecycle
app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  apiScheduler?.stop();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});
