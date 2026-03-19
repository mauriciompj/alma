/**
 * ALMA Demo Seed Runner
 * Populates a Neon database with fictional demo data
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node db/run-seed-demo.mjs
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seedDemo() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set.');
    console.error('Usage: DATABASE_URL="postgresql://..." node db/run-seed-demo.mjs');
    process.exit(1);
  }

  console.log('[ALMA Demo] Reading seed-demo.sql...');
  const seedSql = readFileSync(join(__dirname, 'seed-demo.sql'), 'utf-8');

  const sql = neon(dbUrl);

  // Split by semicolons and execute each statement
  const statements = seedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`[ALMA Demo] Executing ${statements.length} statements...`);

  let success = 0;
  let errors = 0;

  for (const stmt of statements) {
    try {
      await sql(stmt);
      success++;
    } catch (e) {
      errors++;
      // Show first 80 chars of failed statement for debugging
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
      console.error(`  ✗ Failed: ${preview}...`);
      console.error(`    Error: ${e.message}`);
    }
  }

  console.log(`\n[ALMA Demo] Done! ${success} succeeded, ${errors} failed.`);
  console.log('[ALMA Demo] Login credentials:');
  console.log('  - Lucas / demo123');
  console.log('  - Helena / demo123');
  console.log('  - Visitante / demo123');
  console.log('  - Admin / demoadmin');
}

seedDemo().catch(err => {
  console.error('[ALMA Demo] Fatal:', err);
  process.exit(1);
});
