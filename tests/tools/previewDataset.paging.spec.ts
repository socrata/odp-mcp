import { describe, it, expect } from 'vitest';
import { previewDataset } from '../../src/tools/previewDataset.js';

class FakeHttpClient {
  lastCall: any;
  async request(opts: any) {
    this.lastCall = opts;
    return { status: 200, data: [{ id: 1 }] };
  }
}

describe('previewDataset paging caps', () => {
  it('caps limit at 5000', async () => {
    const client = new FakeHttpClient();
    await previewDataset(client as any, { domain: 'example.org', uid: 'abcd', limit: 99999 });
    expect(client.lastCall.query?.$limit).toBe(5000);
  });

  it('defaults limit to 50', async () => {
    const client = new FakeHttpClient();
    await previewDataset(client as any, { domain: 'example.org', uid: 'abcd' });
    expect(client.lastCall.query?.$limit).toBe(50);
  });
});
