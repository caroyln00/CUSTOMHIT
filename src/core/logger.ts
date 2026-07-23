import type { LogLevel } from './env.js';
import { env } from './env.js';

const weights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (weights[level] < weights[env.logLevel]) return;
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...(data ?? {}),
  };
  const output = JSON.stringify(line);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => write('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => write('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => write('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => write('error', message, data),
};
