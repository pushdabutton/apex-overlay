#!/usr/bin/env tsx
// ============================================================
// Production build script
// Builds and packages the Overwolf Electron app
// ============================================================

import { execSync } from 'child_process';

console.log('Building Apex Coach for production...');
execSync('npx electron-vite build', { stdio: 'inherit' });
console.log('Build complete. Output in dist/');
