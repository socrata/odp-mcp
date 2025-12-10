import { describe, it, expect } from 'vitest';
import { previewDataset } from '../../src/tools/previewDataset.js';

class FailingHttpClient {
  async request() {
    const error: any = new Error('HTTP 404: not found');
    error.status = 404;
    throw error;
  }
}

describe('previewDataset tool errors', () => {
  it('bubbles upstream errors', async () => {
    const client = new FailingHttpClient();
    await expect(previewDataset(client as any, { domain: 'example.org', uid: 'missing' })).rejects.toThrow(/404/);
  });
});
