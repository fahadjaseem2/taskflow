import rateLimit, { Options } from 'express-rate-limit';
import { RedisStore, RedisReply } from 'rate-limit-redis';
import { redis } from '../redis';
import { config } from '../config';

// Rate limiting is backed by Redis instead of in-memory storage so it
// works correctly once the backend is scaled to multiple replicas
// (e.g. behind the Kubernetes HPA) - all pods share the same counters.
//
// RedisStore's constructor eagerly loads Lua scripts (EVALSHA/SCRIPT LOAD)
// against whatever `sendCommand` it's given. A jest.mock'd Redis client can't
// satisfy that, so in the test environment we skip constructing a RedisStore
// entirely and fall back to express-rate-limit's built-in in-memory store.
// This middleware is never exercised directly in unit tests anyway (see app.ts);
// integration tests against a real Redis are the right place to test it live.
const baseOptions: Partial<Options> = {
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
};

export const apiRateLimiter =
  config.env === 'test'
    ? rateLimit(baseOptions)
    : rateLimit({
        ...baseOptions,
        store: new RedisStore({
          // ioredis's `call` overloads don't line up with a generic string[] spread,
          // so we go through a loosely-typed reference rather than fighting the types here.
          sendCommand: (...args: string[]) =>
            (redis.call as (...a: string[]) => Promise<RedisReply>)(...args),
          prefix: 'ratelimit:',
        }),
      });
