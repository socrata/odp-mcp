import { describe, it, expect } from 'vitest';
import { listDatasets } from '../../src/tools/listDatasets.js';

class FakeHttpClient {
  calls: any[] = [];
  queue: any[];
  constructor(queue: any[]) {
    this.queue = queue;
  }
  async request(opts: any) {
    this.calls.push(opts);
    const res = this.queue.shift();
    if (res instanceof Error) throw res;
    return res;
  }
}

describe('listDatasets tool', () => {
  it('hits catalog search with default limit', async () => {
    const client = new FakeHttpClient([
      { status: 200, data: { results: [] } }, // search
    ]);
    await listDatasets(client as any, { domain: 'example.org' });
    const firstCall = client.calls[0];
    expect(firstCall.path).toBe('/api/catalog/v1');
    expect(firstCall.query?.limit).toBe(20);
    expect(firstCall.query?.q).toBe('');
    expect(firstCall.query?.domains).toBe('example.org');
  });

  it('passes through query and limit', async () => {
    const client = new FakeHttpClient([
      { status: 200, data: { results: [] } }, // search
    ]);
    await listDatasets(client as any, { domain: 'example.org', query: '311', limit: 5 });
    const firstCall = client.calls[0];
    expect(firstCall.query?.q).toBe('311');
    expect(firstCall.query?.limit).toBe(5);
  });

  it('enriches search results with metadata and preview rows', async () => {
    const client = new FakeHttpClient([
      {
        status: 200,
        data: { results: [{ resource: { id: 'abcd', name: 'Dataset A' } }] },
      }, // search
      {
        status: 200,
        data: { columns: [{ name: 'c1' }], extra: true },
      }, // metadata
      {
        status: 200,
        data: [{ c1: 1 }],
      }, // rows
    ]);
    const res = await listDatasets(client as any, { domain: 'example.org', limit: 1 });
    expect(res.data.datasets[0].id).toBe('abcd');
    expect(res.data.datasets[0].columns[0].name).toBe('c1');
    expect(res.data.datasets[0].previewRows.length).toBe(1);
    expect(client.calls[1].path).toBe('/api/views/abcd.json');
    expect(client.calls[2].path).toBe('/resource/abcd.json');
  });
});
