/**
 * Structured JSON logger for production.
 * Outputs structured logs in production, readable format in development.
 * All logs go to stdout/stderr so Docker/Coolify captures them.
 */

const isProduction = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  if (isProduction) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    return JSON.stringify(entry);
  }

  // Dev: readable format
  const prefix = level === 'error' ? '[ERR]' : level === 'warn' ? '[WARN]' : '[INFO]';
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(formatLog('info', message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(formatLog('warn', message, meta));
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const errorMeta: Record<string, unknown> = { ...meta };

    if (error instanceof Error) {
      errorMeta.error = error.message;
      errorMeta.stack = error.stack;
      if ('code' in error) errorMeta.code = (error as any).code;
    } else if (error !== undefined) {
      errorMeta.error = String(error);
    }

    console.error(formatLog('error', message, errorMeta));
  },

  /** Log an HTTP request error with route context */
  requestError(message: string, error: unknown, req: { method: string; originalUrl: string; ip?: string }) {
    logger.error(message, error, {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });
  },
};
