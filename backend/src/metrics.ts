import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Default Node.js process metrics (memory, CPU, event loop lag, etc.)
client.collectDefaultMetrics({ prefix: 'taskflow_' });

export const httpRequestDuration = new client.Histogram({
  name: 'taskflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new client.Counter({
  name: 'taskflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const cacheHitsTotal = new client.Counter({
  name: 'taskflow_cache_hits_total',
  help: 'Total number of Redis cache hits',
});

export const cacheMissesTotal = new client.Counter({
  name: 'taskflow_cache_misses_total',
  help: 'Total number of Redis cache misses',
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    // req.route is only set once Express matches a route; fall back to path.
    const route = req.route?.path ?? req.path;
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });
  });
  next();
}

export { client as promClient };
