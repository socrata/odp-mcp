import { describe, it, expect } from 'vitest';
import { previewDataset } from '../../src/tools/previewDataset.js';
import { DEFAULT_PREVIEW_LIMIT } from '../../src/limits.js';

class FakeHttpClient {
  lastCall: any;
  async request(opts: any) {
    this.lastCall = opts;
    return { status: 200, data: [] };
  }
}

describe('previewDataset tool', () => {
  it('uses resource path and default limit', async () => {
    const client = new FakeHttpClient();
    await previewDataset(client as any, { domain: 'example.org', uid: 'abcd' });
    expect(client.lastCall.path).toBe('/resource/abcd.json');
    expect(client.lastCall.query?.$limit).toBe(DEFAULT_PREVIEW_LIMIT);
  });

  it('accepts custom limit', async () => {
    const client = new FakeHttpClient();
    await previewDataset(client as any, { domain: 'example.org', uid: 'abcd', limit: 5 });
    expect(client.lastCall.query?.$limit).toBe(5);
  });

  it('clamps limit to max', async () => {
    const client = new FakeHttpClient();
    await previewDataset(client as any, { domain: 'example.org', uid: 'abcd', limit: 6000 });
    expect(client.lastCall.query?.$limit).toBe(5000);
  });
});
