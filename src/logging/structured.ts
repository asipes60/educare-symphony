/**
 * Structured stdout logger. GitHub Actions captures stdout, so this is the
 * primary observability surface alongside the Run Log table.
 */

import pino from 'pino';

const isDev = process.env.SYMPHONY_ENV === 'local';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  }),
  base: {
    service: 'educare-symphony',
    env: process.env.SYMPHONY_ENV || 'production',
  },
});

export function taskLogger(taskId: string) {
  return logger.child({ taskId });
}
