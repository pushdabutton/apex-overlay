#!/usr/bin/env tsx
// ============================================================
// Manual migration runner
// Use: npx tsx scripts/migrate.ts
// ============================================================

console.log('Running migrations...');
console.log('Note: Migrations auto-run on app start via database.ts');
console.log('This script is for manual/debug use only.');

// In production, migrations are handled by src/main/db/database.ts
// This script can be extended for manual migration tasks like:
// - Creating test databases
// - Running specific migrations
// - Rolling back migrations (not yet implemented)
