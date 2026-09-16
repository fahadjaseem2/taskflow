import { runMigrations, pool } from './db';
import { logger } from './logger';

async function migrate(): Promise<void> {
  try {
    await runMigrations();

    logger.info('Database migration completed successfully');
  } catch (err) {
    logger.error('Database migration failed', {
      error: err,
    });

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();