import { describe, it, expect } from 'vitest';
import { listDatasets } from '../../src/tools/listDatasets.js';

class FailingHttpClient {
  calls: any[] = [];
  async request() {
    const error: any = new Error('HTTP 500: server error');
    error.status = 500;
    throw error;
  }
}

describe('listDatasets tool errors', () => {
  it('bubbles upstream errors', async () => {
    const client = new FailingHttpClient();
    await expect(listDatasets(client as any, { domain: 'example.org' })).rejects.toThrow(/500/);
  });
});
