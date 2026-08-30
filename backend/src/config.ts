import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  db: {
    host: required('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: required('DB_USER', 'taskflow'),
    password: required('DB_PASSWORD', 'taskflow'),
    database: required('DB_NAME', 'taskflow'),
  },
  redis: {
    host: required('REDIS_HOST', 'localhost'),
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '30', 10),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },
  jwt: {
    secret: required('JWT_SECRET', 'dev-only-secret-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'TaskFlow <no-reply@taskflow.local>',
  },
};
