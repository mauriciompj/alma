/**
 * ALMA Backup Script — Export all Neon database tables to JSON
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node db/backup.mjs
 *
 * Creates a timestamped JSON file in db/backups/ with all ALMA data.
 * Run weekly (manually or via cron/scheduled task) to protect against data loss.
 *
 * The content of ALMA is unique and irreplaceable — this is not optional.
 */

import { neon } from '@neondatabase/serverless';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, 'backups');

async function backup() {
  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set. Run with: DATABASE_URL="postgresql://..." node db/backup.mjs');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupData = { exportedAt: new Date().toISOString(), tables: {} };

  // Tables to back up (add new ones here as schema evolves)
  const tables = [
    'alma_config',
    'alma_chunks',
    'alma_corrections',
    'alma_directives',
    'alma_documents',
  ];

  console.log(`[ALMA Backup] Starting export at ${backupData.exportedAt}`);

  for (const table of tables) {
    try {
      const rows = await sql(`SELECT * FROM ${table} ORDER BY 1`);
      backupData.tables[table] = {
        rowCount: rows.length,
        rows: rows,
      };
      console.log(`  ✓ ${table}: ${rows.length} rows`);
    } catch (e) {
      if (e.message.includes('does not exist')) {
        console.log(`  - ${table}: table not found (skipped)`);
        backupData.tables[table] = { rowCount: 0, rows: [], note: 'table not found' };
      } else {
        console.error(`  ✗ ${table}: ${e.message}`);
        backupData.tables[table] = { rowCount: 0, rows: [], error: e.message };
      }
    }
  }

  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filename = `alma-backup-${timestamp}.json`;
  const filepath = join(BACKUP_DIR, filename);

  writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

  const sizeMB = (Buffer.byteLength(JSON.stringify(backupData)) / 1024 / 1024).toFixed(2);
  console.log(`\n[ALMA Backup] Done! Saved to: ${filepath} (${sizeMB} MB)`);
  console.log(`[ALMA Backup] Total tables: ${Object.keys(backupData.tables).length}`);

  return filepath;
}

backup().catch(err => {
  console.error('[ALMA Backup] Fatal error:', err);
  process.exit(1);
});
