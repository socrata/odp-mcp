import { describe, it, expect } from 'vitest';
import { queryDataset } from '../../src/tools/queryDataset.js';

class FakeHttpClient {
  lastCall: any;
  async request(opts: any) {
    this.lastCall = opts;
    return { status: 200, data: [{ id: 1 }] };
  }
}

describe('queryDataset paging caps', () => {
  it('caps limit at 5000 and offset at 50000', async () => {
    const client = new FakeHttpClient();
    await queryDataset(client as any, { domain: 'example.org', uid: 'abcd', limit: 99999, offset: 999999 });
    expect(client.lastCall.query?.$limit).toBe(5000);
    expect(client.lastCall.query?.$offset).toBe(50000);
  });

  it('defaults limit to 500 when omitted', async () => {
    const client = new FakeHttpClient();
    await queryDataset(client as any, { domain: 'example.org', uid: 'abcd' });
    expect(client.lastCall.query?.$limit).toBe(500);
    expect(client.lastCall.query?.$offset).toBe(0);
  });
});
