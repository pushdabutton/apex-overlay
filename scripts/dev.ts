#!/usr/bin/env tsx
// ============================================================
// Development startup script
// Runs electron-vite in dev mode with HMR
// ============================================================

import { execSync } from 'child_process';

console.log('Starting Apex Coach in development mode...');
execSync('npx electron-vite dev', { stdio: 'inherit' });
