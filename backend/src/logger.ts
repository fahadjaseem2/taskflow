import winston from 'winston';
import { config } from './config';

// JSON structured logs to stdout so Docker's log driver picks them up
// and Promtail can ship them to Loki without extra parsing gymnastics.
export const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'taskflow-backend' },
  transports: [new winston.transports.Console()],
});
