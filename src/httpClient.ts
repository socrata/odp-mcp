import type { DomainConfig } from './config.js';
import { RateLimiter } from './rateLimiter.js';

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

export class HttpClient {
  private limiter?: { allow: () => boolean };

  constructor(private domain: DomainConfig) {
    if (domain.limits?.requestsPerHour) {
      this.limiter = new RateLimiter(domain.limits.requestsPerHour);
    }
  }

  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await this.performRequest<T>(options);
      } catch (err: any) {
        lastError = err;
        const status = this.extractStatus(err);
        const isRetryable = status === 429 || (status && status >= 500 && status < 600);
        if (!isRetryable || attempt >= maxAttempts) break;
        const backoffMs = 100 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async performRequest<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    if (this.limiter && !this.limiter.allow()) {
      const error: any = new Error('HTTP 429: client rate limit exceeded');
      error.status = 429;
      throw error;
    }

    const url = this.buildUrl(options.path, options.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    };

    this.attachAuth(headers, options.authOverride);

    const controller = new AbortController();
    const timeout = options.timeoutMs ?? 15000;
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

      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const msg = typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
        const error: any = new Error(`HTTP ${res.status}: ${msg}`);
        error.status = res.status;
        error.data = data;
        throw error;
      }

      const headerObj: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      return { status: res.status, headers: headerObj, data };
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

  private extractStatus(err: any): number | undefined {
    if (err && typeof err.status === 'number') return err.status;
    const match = typeof err?.message === 'string' ? err.message.match(/^HTTP (\d{3})/) : null;
    return match ? Number(match[1]) : undefined;
  }
}
