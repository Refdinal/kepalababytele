import pg from 'pg';
import { config } from '../config.js';

const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl && !isLocal ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

export async function withTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
