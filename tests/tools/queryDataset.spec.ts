import { describe, it, expect } from 'vitest';
import { queryDataset } from '../../src/tools/queryDataset.js';
import { DEFAULT_DEFAULT_LIMIT } from '../../src/limits.js';

class FakeHttpClient {
  lastCall: any;
  async request(opts: any) {
    this.lastCall = opts;
    return { status: 200, data: [] };
  }
}

describe('queryDataset tool', () => {
  it('injects SoQL into $query param', async () => {
    const client = new FakeHttpClient();
    await queryDataset(client as any, {
      domain: 'example.org',
      uid: 'abcd',
      select: ['a', 'b'],
      limit: 5,
    });
    expect(client.lastCall.query?.$query).toContain('select a, b');
    expect(client.lastCall.path).toBe('/resource/abcd.json');
  });

  it('clamps limit and offset', async () => {
    const client = new FakeHttpClient();
    await queryDataset(client as any, {
      domain: 'example.org',
      uid: 'abcd',
      select: ['a'],
      limit: 6000,
      offset: 100000,
    });
    const q = client.lastCall.query?.$query as string;
    expect(q).toContain('limit 5000');
    expect(q).toContain('offset 50000');
  });

  it('applies default limit when absent', async () => {
    const client = new FakeHttpClient();
    await queryDataset(client as any, { domain: 'example.org', uid: 'abcd' });
    expect(client.lastCall.query?.$limit).toBe(DEFAULT_DEFAULT_LIMIT);
    expect(client.lastCall.query?.$offset).toBe(0);
  });
});
