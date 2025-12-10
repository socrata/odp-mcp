// Structured logging module for tool requests and SoQL queries
// Outputs JSON logs for easy parsing by log aggregation systems (Heroku, Datadog, etc.)

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

// Environment-based configuration
const LOG_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() ?? 'info') as LogLevel;
const LOG_FORMAT = process.env.LOG_FORMAT?.toLowerCase() ?? 'json'; // 'json' or 'text'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function formatLog(entry: LogEntry): string {
  if (LOG_FORMAT === 'text') {
    const { timestamp, level, message, ...extra } = entry;
    const extraStr = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    return `[${timestamp}] ${level.toUpperCase()} ${message}${extraStr}`;
  }
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = formatLog(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),

  // Specialized loggers for common operations
  toolRequest: (toolName: string, input: Record<string, unknown>, requestId?: string) => {
    // Redact sensitive fields
    const sanitizedInput = { ...input };
    if (sanitizedInput.password) sanitizedInput.password = '[REDACTED]';
    if (sanitizedInput.bearerToken) sanitizedInput.bearerToken = '[REDACTED]';
    if (sanitizedInput.appToken) sanitizedInput.appToken = '[REDACTED]';

    log('info', `Tool request: ${toolName}`, {
      tool: toolName,
      input: sanitizedInput,
      requestId,
    });
  },

  toolResponse: (
    toolName: string,
    durationMs: number,
    success: boolean,
    rowCount?: number,
    requestId?: string,
    error?: string,
  ) => {
    log(success ? 'info' : 'error', `Tool response: ${toolName}`, {
      tool: toolName,
      durationMs,
      success,
      rowCount,
      requestId,
      error,
    });
  },

  soqlQuery: (domain: string, uid: string, soql: string, requestId?: string) => {
    log('info', 'SoQL query generated', {
      domain,
      uid,
      soql,
      requestId,
    });
  },

  httpRequest: (method: string, path: string, statusCode?: number, durationMs?: number) => {
    log('info', `HTTP ${method} ${path}`, {
      method,
      path,
      statusCode,
      durationMs,
    });
  },
};

// Request ID generator for tracing
let requestCounter = 0;
export function generateRequestId(): string {
  requestCounter++;
  return `req_${Date.now()}_${requestCounter}`;
}
