import { describe, it, expect } from 'vitest';
import { getMetadata } from '../../src/tools/getMetadata.js';

class FakeHttpClient {
  calls = 0;
  lastCall: any;
  async request(opts: any) {
    this.calls += 1;
    this.lastCall = opts;
    return { status: 200, data: { id: 'cached' } };
  }
}

describe('getMetadata tool', () => {
  it('calls views endpoint with uid', async () => {
    const client = new FakeHttpClient();
    await getMetadata(client as any, { domain: 'example.org', uid: 'abcd' });
    expect(client.lastCall.path).toBe('/api/views/abcd.json');
    expect(client.lastCall.method).toBe('GET');
  });

  it('caches repeated metadata lookups', async () => {
    const client = new FakeHttpClient();
    const first = await getMetadata(client as any, { domain: 'example.org', uid: 'efgh' });
    const second = await getMetadata(client as any, { domain: 'example.org', uid: 'efgh' });
    expect(client.calls).toBe(1);
    expect(second).toBe(first);
  });

  it('bubbles errors when metadata fetch fails', async () => {
    class ErrorClient extends FakeHttpClient {
      async request(_opts: any) {
        const err: any = new Error('HTTP 400: bad request');
        err.status = 400;
        return Promise.reject(err);
      }
    }
    const client = new ErrorClient();
    await expect(getMetadata(client as any, { domain: 'example.org', uid: 'bad' })).rejects.toThrow(/400/);
  });
});
