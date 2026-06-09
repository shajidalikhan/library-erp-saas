/**
 * Lightweight logger. Kept dependency-free on purpose so it can be used
 * inside env-loading and other "boot phase" modules.
 *
 * In production you may swap this for pino/winston without changing call sites.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const CURRENT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || 'info';

const shouldLog = (level: LogLevel): boolean =>
  LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[CURRENT_LEVEL];

const ts = () => new Date().toISOString();

const fmt = (level: LogLevel, args: unknown[]): unknown[] => [
  `[${ts()}] [${level.toUpperCase()}]`,
  ...args,
];

export const logger = {
  error: (...args: unknown[]) =>
    shouldLog('error') && console.error(...fmt('error', args)),
  warn: (...args: unknown[]) =>
    shouldLog('warn') && console.warn(...fmt('warn', args)),
  info: (...args: unknown[]) =>
    shouldLog('info') && console.info(...fmt('info', args)),
  http: (...args: unknown[]) =>
    shouldLog('http') && console.log(...fmt('http', args)),
  debug: (...args: unknown[]) =>
    shouldLog('debug') && console.debug(...fmt('debug', args)),
};
