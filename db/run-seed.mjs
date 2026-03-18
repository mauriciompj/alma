#!/usr/bin/env node
/**
 * ALMA — Database Seed Runner
 *
 * Reads seed.sql and executes it against your Neon database.
 *
 * Usage:
 *   node db/run-seed.mjs
 *
 * Requires DATABASE_URL in your .env file.
 */

import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config(); // Load .env

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  console.error('   Copy .env.example to .env and fill in your Neon connection string.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const seedPath = new URL('./seed.sql', import.meta.url);
const seedSQL = readFileSync(seedPath, 'utf-8');

// Split by semicolons and run each statement
const statements = seedSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log('🌱 Running ALMA database seed...\n');

let success = 0;
let errors = 0;

for (const stmt of statements) {
  try {
    await sql(stmt);
    success++;
    // Show first 60 chars of each statement
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);
    console.log(`  ✓ ${preview}...`);
  } catch (err) {
    errors++;
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);
    console.log(`  ✗ ${preview}...`);
    console.log(`    → ${err.message}\n`);
  }
}

console.log(`\n✅ Seed complete: ${success} succeeded, ${errors} failed.`);

if (errors === 0) {
  console.log('\n🎉 Your ALMA database is ready!');
  console.log('   Next steps:');
  console.log('   1. Edit the users_json in alma_config with your real user data');
  console.log('   2. Add memories through the admin panel or via SQL');
  console.log('   3. Deploy to Netlify and start your legacy\n');
}
