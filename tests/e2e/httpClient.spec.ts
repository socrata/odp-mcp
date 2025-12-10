import { describe, it, expect } from 'vitest';
import { HttpClient } from '../../src/httpClient.js';
import type { DomainConfig } from '../../src/config.js';

const runE2E = process.env.RUN_E2E === 'true';

// End-to-end smoke test against a public Socrata dataset. Skipped by default unless RUN_E2E=true.
const testFn = runE2E ? it : it.skip;

describe('HttpClient integration (red stage)', () => {
  const domain: DomainConfig = {
    domain: 'data.cityofnewyork.us',
    auth: { mode: 'none' },
  };

  testFn('fetches a single row from a public dataset', async () => {
    const client = new HttpClient(domain);
    // NYC 311 Service Requests sample dataset UID: nc67-uf89 (public)
    const res = await client.request({
      method: 'GET',
      path: '/resource/nc67-uf89.json',
      query: { $limit: 1 },
      timeoutMs: 20000,
    });
    const data = res.data as unknown[];
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  }, 30000);
});
