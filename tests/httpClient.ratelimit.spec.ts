import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpClient } from '../src/httpClient.js';
import type { DomainConfig } from '../src/config.js';

const domain: DomainConfig = {
  domain: 'example.org',
  auth: { mode: 'none' },
  limits: { requestsPerHour: 1 },
};

function okResponse() {
  return new Response(JSON.stringify([{ ok: true }]), { status: 200 });
}

describe('HttpClient client-side rate limiting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws 429 when allowance is exceeded', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any).mockResolvedValue(okResponse() as any);
    const client = new HttpClient(domain);

    await client.request({ method: 'GET', path: '/resource/demo.json' });
    await expect(client.request({ method: 'GET', path: '/resource/demo.json' })).rejects.toThrow(/429/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
