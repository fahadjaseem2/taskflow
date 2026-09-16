import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { logger } from './logger';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error('Unexpected Postgres pool error', { error: err.message });
});

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const result = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.info(`Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf-8',
    );

    logger.info(`Running migration: ${file}`);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(sql);

      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  logger.info('Migrations complete');
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.error('Database health check failed', {
      error: (err as Error).message,
    });
    return false;
  }
}