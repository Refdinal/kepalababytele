import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';
import { isDatabaseConfigured } from '../config.js';

const migrationsDir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL belum diisi di backend/.env');
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (rowCount > 0) {
        console.log(`skip    ${file}`);
        continue;
      }
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    console.log('Migrasi selesai.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
