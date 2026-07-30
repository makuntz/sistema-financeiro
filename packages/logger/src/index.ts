export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogAttributes = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  debug(message: string, attributes?: LogAttributes): void;
  info(message: string, attributes?: LogAttributes): void;
  warn(message: string, attributes?: LogAttributes): void;
  error(message: string, attributes?: LogAttributes): void;
  child(attributes: LogAttributes): Logger;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'secret',
  'jwt',
  'accesskey',
  'secretkey',
  'apikey',
]);

export function sanitizeAttributes(attributes: LogAttributes = {}): LogAttributes {
  const sanitized: LogAttributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '');
    sanitized[key] = SENSITIVE_KEYS.has(normalized) ? '[REDACTED]' : value;
  }

  return sanitized;
}

export class ConsoleLogger implements Logger {
  constructor(private readonly baseAttributes: LogAttributes = {}) {}

  debug(message: string, attributes?: LogAttributes): void {
    this.write('debug', message, attributes);
  }

  info(message: string, attributes?: LogAttributes): void {
    this.write('info', message, attributes);
  }

  warn(message: string, attributes?: LogAttributes): void {
    this.write('warn', message, attributes);
  }

  error(message: string, attributes?: LogAttributes): void {
    this.write('error', message, attributes);
  }

  child(attributes: LogAttributes): Logger {
    return new ConsoleLogger({ ...this.baseAttributes, ...attributes });
  }

  private write(level: LogLevel, message: string, attributes?: LogAttributes): void {
    const payload = {
      level,
      message,
      ...sanitizeAttributes({ ...this.baseAttributes, ...attributes }),
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(payload);

    if (level === 'error') {
      console.error(line);
      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  }
}
