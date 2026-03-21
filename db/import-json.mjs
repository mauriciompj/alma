/**
 * ALMA Import Script — Imports chunks from a JSON export file
 * Usage: DATABASE_URL="postgresql://..." node db/import-json.mjs path/to/file.json
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
const filePath = process.argv[2];

if (!dbUrl) { console.error('ERROR: Set DATABASE_URL env var'); process.exit(1); }
if (!filePath) { console.error('Usage: node db/import-json.mjs <file.json>'); process.exit(1); }

const sql = neon(dbUrl);
const data = JSON.parse(readFileSync(filePath, 'utf-8'));
const chunks = data.chunks || [];

console.log(`[ALMA Import] File: ${filePath}`);
console.log(`[ALMA Import] Chunks to import: ${chunks.length}`);

// Check current count
const before = await sql`SELECT COUNT(*) as c FROM alma_chunks`;
console.log(`[ALMA Import] Current chunks in DB: ${before[0].c}`);

let ok = 0, errors = 0;
for (const chunk of chunks) {
  try {
    await sql`
      INSERT INTO alma_chunks (title, category, content, tags, source_file, char_count, chunk_index, search_vector)
      VALUES (${chunk.title}, ${chunk.category}, ${chunk.content}, ${chunk.tags || [chunk.category]}::TEXT[],
              ${chunk.source_file || 'import_json'}, ${chunk.content.length}, 0,
              to_tsvector('portuguese', ${chunk.title || ''} || ' ' || ${chunk.content}))
    `;
    ok++;
    process.stdout.write('.');
  } catch (e) {
    errors++;
    console.error(`\n  ERR [${chunk.title?.slice(0,40)}]: ${e.message.slice(0,80)}`);
  }
}

const after = await sql`SELECT COUNT(*) as c FROM alma_chunks`;
console.log(`\n\n[ALMA Import] Done!`);
console.log(`  Before: ${before[0].c} chunks`);
console.log(`  After:  ${after[0].c} chunks`);
console.log(`  Imported: ${ok} | Errors: ${errors}`);
