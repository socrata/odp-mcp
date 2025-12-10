import type { DomainConfig } from './config.js';
import { RateLimiter } from './rateLimiter.js';

// Default values for HTTP client settings
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 100;

export interface HttpClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string; // path after domain, e.g., "/resource/abcd.json"
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
  authOverride?: DomainConfig['auth'];
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

// Custom error class with HTTP status code
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpClient {
  private limiter?: { allow: () => boolean };
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(
    private domain: DomainConfig,
    options?: HttpClientOptions,
  ) {
    if (domain.limits?.requestsPerHour) {
      this.limiter = new RateLimiter(domain.limits.requestsPerHour);
    }
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseMs = options?.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  }

  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxRetries) {
      attempt += 1;
      try {
        return await this.performRequest<T>(options);
      } catch (err: unknown) {
        lastError = err;
        const status = this.extractStatus(err);
        const isRetryable = status === 429 || (status !== undefined && status >= 500 && status < 600);
        if (!isRetryable || attempt >= this.maxRetries) break;
        const backoffMs = this.retryBaseMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async performRequest<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    if (this.limiter && !this.limiter.allow()) {
      throw new HttpError('HTTP 429: client rate limit exceeded', 429);
    }

    const url = this.buildUrl(options.path, options.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    };

    this.attachAuth(headers, options.authOverride);

    const controller = new AbortController();
    const timeout = options.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);

    const fetchOpts: RequestInit = {
      method: options.method,
      headers,
      signal: controller.signal,
    };

    if (options.body && options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(url, fetchOpts);
      const text = await res.text();

      let data: T | string | null = null;
      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const msg = typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
        throw new HttpError(`HTTP ${res.status}: ${msg}`, res.status, data);
      }

      const headerObj: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      return { status: res.status, headers: headerObj, data: data as T };
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const base = `https://${this.domain.domain}`;
    const url = new URL(path, base);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.append(key, String(value));
      }
    }
    return url.toString();
  }

  private attachAuth(headers: Record<string, string>, override?: DomainConfig['auth']) {
    const auth = override ?? this.domain.auth;
    switch (auth.mode) {
      case 'appToken':
        if (auth.appToken) headers['X-App-Token'] = auth.appToken;
        break;
      case 'basic':
        if (auth.username && auth.password) {
          const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${creds}`;
        }
        break;
      case 'oauth2':
        if (auth.bearerToken) headers['Authorization'] = `Bearer ${auth.bearerToken}`;
        break;
      case 'none':
      default:
        break;
    }
  }

  private extractStatus(err: unknown): number | undefined {
    if (err instanceof HttpError) return err.status;
    if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
      return (err as { status: number }).status;
    }
    if (err instanceof Error) {
      const match = err.message.match(/^HTTP (\d{3})/);
      return match ? Number(match[1]) : undefined;
    }
    return undefined;
  }
}
