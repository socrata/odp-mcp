import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpClient } from '../src/httpClient.js';
import type { DomainConfig } from '../src/config.js';

const domain: DomainConfig = {
  domain: 'example.org',
  auth: { mode: 'none' },
};

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('HttpClient retry/backoff (red)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    const first = jsonResponse({ message: 'rate limited' }, 429, { 'retry-after': '0' });
    const second = jsonResponse([{ id: 1 }], 200);

    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(first as any).mockResolvedValueOnce(second as any);

    const client = new HttpClient(domain);
    const res = await client.request({ method: 'GET', path: '/resource/demo.json' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});
