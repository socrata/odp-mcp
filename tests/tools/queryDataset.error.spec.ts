import { describe, it, expect } from 'vitest';
import { queryDataset } from '../../src/tools/queryDataset.js';

class FailingHttpClient {
  async request() {
    const error: any = new Error('HTTP 429: rate limited');
    error.status = 429;
    throw error;
  }
}

describe('queryDataset tool errors', () => {
  it('surfaces 429 errors to caller', async () => {
    const client = new FailingHttpClient();
    await expect(
      queryDataset(client as any, { domain: 'example.org', uid: 'abcd', limit: 10 }),
    ).rejects.toThrow(/429/);
  });
});
