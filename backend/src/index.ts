import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';

async function start(): Promise<void> {
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`TaskFlow backend listening on port ${config.port}`, {
      env: config.env,
    });
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);

    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit if graceful shutdown hangs
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();