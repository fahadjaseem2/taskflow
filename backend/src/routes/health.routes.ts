import { Router, Request, Response } from 'express';
import { checkDbConnection } from '../db';
import { checkRedisConnection } from '../redis';
import { promClient } from '../metrics';

const router = Router();

// Liveness: is the process running at all. Kubernetes restarts the pod if this fails.
router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: can this pod actually serve traffic (DB/Redis reachable).
// Kubernetes pulls the pod out of the Service's endpoints if this fails.
router.get('/readyz', async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([checkDbConnection(), checkRedisConnection()]);
  const ready = dbOk && redisOk;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not ready', db: dbOk, redis: redisOk });
});

// Prometheus scrape endpoint.
router.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

export default router;
