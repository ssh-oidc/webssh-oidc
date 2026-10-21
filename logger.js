// Shared logger configuration for server.js
// This is separate from src/lib/server/logger.ts to avoid import issues
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // @ts-expect-error pino's types omit the supported `sync` option
  sync: true, // Disable async logging for immediate output
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

export default logger;
