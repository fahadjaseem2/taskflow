import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { metricsMiddleware } from './metrics';
import { apiRateLimiter } from './middleware/rateLimiter';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import projectsRouter from './routes/projects.routes';
import tasksRouter from './routes/tasks.routes';
import dashboardRouter from './routes/dashboard.routes';
import healthRouter from './routes/health.routes';
import { logger } from './logger';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(metricsMiddleware);

  app.use((req, _res, next) => {
    logger.debug('Incoming request', { method: req.method, path: req.path });
    next();
  });

  // Health/metrics endpoints are exempt from rate limiting and auth so k8s
  // probes and Prometheus scraping never get throttled or blocked.
  app.use('/', healthRouter);

  // Auth endpoints are rate-limited but don't require a token (you don't
  // have one yet). Everything else requires a valid JWT.
  app.use('/api/auth', apiRateLimiter, authRouter);
  app.use('/api/projects', apiRateLimiter, requireAuth, projectsRouter);
  app.use('/api/tasks', apiRateLimiter, requireAuth, tasksRouter);
  app.use('/api/dashboard', apiRateLimiter, requireAuth, dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
