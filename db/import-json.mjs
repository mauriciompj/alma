#!/usr/bin/env node
/**
 * ALMA Import Script — Imports chunks from a curated JSON file
 *
 * Usage:
 *   node db/import-json.mjs path/to/file.json
 *   node db/import-json.mjs path/to/file.json --dry-run
 *
 * Expects JSON with structure:
 *   {
 *     "title": "Batch title",
 *     "source_file": "curated/my_batch",   // fallback for chunks without source_file
 *     "chunks": [
 *       { "title": "...", "category": "...", "content": "...",
 *         "tags": [...], "source_file": "...", "chunk_index": 1 }
 *     ]
 *   }
 *
 * Loads .env automatically (same as run-seed.mjs).
 * Validates required fields before inserting.
 * Respects chunk_index from JSON (falls back to array position).
 * Detects duplicates by (title + source_file) to prevent re-importing.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config(); // Load .env

const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
const filePath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found.');
  console.error('  Set it in your .env file or pass it inline:');
  console.error('  DATABASE_URL="postgresql://..." node db/import-json.mjs <file.json>');
  process.exit(1);
}
if (!filePath) {
  console.error('Usage: node db/import-json.mjs <file.json> [--dry-run]');
  process.exit(1);
}

const sql = neon(dbUrl);
const data = JSON.parse(readFileSync(filePath, 'utf-8'));
const chunks = data.chunks || [];
const batchSourceFile = data.source_file || 'import_json';

console.log(`[ALMA Import] File: ${filePath}`);
console.log(`[ALMA Import] Batch source_file: ${batchSourceFile}`);
console.log(`[ALMA Import] Chunks to import: ${chunks.length}`);
if (dryRun) console.log('[ALMA Import] DRY RUN — no data will be written\n');

// Validate all chunks before inserting any
const errors = [];
for (let i = 0; i < chunks.length; i++) {
  const c = chunks[i];
  if (!c.content || !c.content.trim()) {
    errors.push(`  chunk[${i}]: missing or empty "content"`);
  }
  if (!c.title || !c.title.trim()) {
    errors.push(`  chunk[${i}]: missing or empty "title"`);
  }
}
if (errors.length > 0) {
  console.error('[ALMA Import] Validation failed:\n' + errors.join('\n'));
  process.exit(1);
}

// Check current count
const before = await sql`SELECT COUNT(*) as c FROM alma_chunks`;
console.log(`[ALMA Import] Current chunks in DB: ${before[0].c}\n`);

let imported = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  const title = chunk.title.trim();
  const content = chunk.content.trim();
  const category = chunk.category || 'manual';
  const tags = chunk.tags || [category];
  const sourceFile = chunk.source_file || batchSourceFile;
  const chunkIndex = (chunk.chunk_index != null) ? chunk.chunk_index : i;

  // Dedup check: skip if same content already exists in this source
  // Uses LEFT(content, 200) to handle large texts efficiently
  const contentPrefix = content.slice(0, 200);
  const existing = await sql`
    SELECT id FROM alma_chunks
    WHERE LEFT(content, 200) = ${contentPrefix} AND source_file = ${sourceFile}
    LIMIT 1
  `;
  if (existing.length > 0) {
    skipped++;
    console.log(`  SKIP [${i}] "${title.slice(0, 50)}" (already exists, id=${existing[0].id})`);
    continue;
  }

  if (dryRun) {
    imported++;
    console.log(`  OK   [${i}] "${title.slice(0, 50)}" (cat=${category}, idx=${chunkIndex}, ${content.length} chars)`);
    continue;
  }

  try {
    await sql`
      INSERT INTO alma_chunks (title, category, content, tags, source_file, char_count, chunk_index, search_vector)
      VALUES (${title}, ${category}, ${content}, ${tags}::TEXT[],
              ${sourceFile}, ${content.length}, ${chunkIndex},
              to_tsvector('portuguese', ${title} || ' ' || ${content}))
    `;
    imported++;
    console.log(`  OK   [${i}] "${title.slice(0, 50)}" (cat=${category}, idx=${chunkIndex})`);
  } catch (e) {
    failed++;
    console.error(`  FAIL [${i}] "${title.slice(0, 50)}": ${e.message.slice(0, 100)}`);
  }
}

const after = dryRun ? before : await sql`SELECT COUNT(*) as c FROM alma_chunks`;
console.log(`\n[ALMA Import] Done!`);
console.log(`  Before:   ${before[0].c} chunks`);
console.log(`  After:    ${after[0].c} chunks`);
console.log(`  Imported: ${imported} | Skipped (dedup): ${skipped} | Errors: ${failed}`);
if (dryRun) console.log('  (dry run — nothing was written)');
