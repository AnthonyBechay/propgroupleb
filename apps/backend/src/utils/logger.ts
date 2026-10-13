/**
 * The application log.
 *
 * One line per thing that happened, readable as it scrolls past in Coolify:
 *
 *   14:25:07 INFO  Chat message stored  channel=WHATSAPP direction=IN type=audio conversation=cmg1…
 *   14:25:21 INFO  Auto-reply: sent  conversation=cmg1… reason="Replied with 2 properties."
 *   14:25:40 ERROR Chat send failed  status=401 reason="Invalid API key"
 *
 * Four levels, and what belongs at each:
 *   error — something failed and somebody should look
 *   warn  — it worked, or was skipped, in a way worth knowing about
 *   info  — a real event: a message arrived, a client was created, a reply went
 *           out, money was spent
 *   debug — detail only useful while chasing a problem (off by default)
 *
 * Env:
 *   LOG_LEVEL  — debug | info (default) | warn | error
 *   LOG_FORMAT — text (default) | json, for a log collector that wants structure
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.LOG_LEVEL ?? '').toLowerCase() as LogLevel;
const threshold = ORDER[configured] ?? ORDER.info;
const asJson = (process.env.LOG_FORMAT ?? '').toLowerCase() === 'json';

/** `key=value`, quoting anything with a space so a line still splits cleanly. */
function field(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[\s"=]/.test(text) ? `${key}=${JSON.stringify(text)}` : `${key}=${text}`;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < threshold) return;

  let line: string;
  if (asJson) {
    line = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...meta });
  } else {
    // The stack is the one field that needs its own lines.
    const { stack, ...rest } = meta ?? {};
    const fields = Object.entries(rest).map(([k, v]) => field(k, v)).filter(Boolean).join(' ');
    const time = new Date().toISOString().slice(11, 19);
    line = `${time} ${level.toUpperCase().padEnd(5)} ${message}${fields ? `  ${fields}` : ''}${stack ? `\n${stack}` : ''}`;
  }

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    write('debug', message, meta);
  },

  info(message: string, meta?: Record<string, unknown>) {
    write('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>) {
    write('warn', message, meta);
  },

  /**
   * `error` is the thrown value; `meta` is context. A plain object passed as
   * `error` is taken as context — that call shape is common, and reading it as
   * an error used to print the useless `error="[object Object]"`.
   */
  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const details: Record<string, unknown> = { ...meta };

    if (error instanceof Error) {
      details.error = error.message;
      // A stack helps for a crash, not for "Meta answered 400".
      if (!('statusCode' in error)) details.stack = error.stack;
      if ('code' in error) details.code = (error as { code?: unknown }).code;
    } else if (error && typeof error === 'object') {
      Object.assign(details, error);
    } else if (error !== undefined) {
      details.error = String(error);
    }

    write('error', message, details);
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
