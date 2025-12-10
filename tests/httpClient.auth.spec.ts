import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpClient } from '../src/httpClient.js';
import type { DomainConfig } from '../src/config.js';

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

describe('HttpClient auth headers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds X-App-Token for appToken mode', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(okResponse() as any);
    const domain: DomainConfig = {
      domain: 'example.org',
      auth: { mode: 'appToken', appToken: 'token123' },
    };
    const client = new HttpClient(domain);
    await client.request({ method: 'GET', path: '/resource/demo.json' });
    const headers = (fetchSpy.mock.calls[0][1] as any)?.headers as Record<string, string>;
    expect(headers['X-App-Token']).toBe('token123');
  });

  it('adds Authorization Basic header', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(okResponse() as any);
    const domain: DomainConfig = {
      domain: 'example.org',
      auth: { mode: 'basic', username: 'user', password: 'pass' },
    };
    const client = new HttpClient(domain);
    await client.request({ method: 'GET', path: '/resource/demo.json' });
    const headers = (fetchSpy.mock.calls[0][1] as any)?.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
  });

  it('adds Authorization Bearer header', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(okResponse() as any);
    const domain: DomainConfig = {
      domain: 'example.org',
      auth: { mode: 'oauth2', bearerToken: 'token123' },
    };
    const client = new HttpClient(domain);
    await client.request({ method: 'GET', path: '/resource/demo.json' });
    const headers = (fetchSpy.mock.calls[0][1] as any)?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token123');
  });
});
