import { describe, it, expect } from 'vitest';
import { createClientRegistry, getClient } from '../../src/clients.js';
import { queryDataset } from '../../src/tools/queryDataset.js';
import type { ServerConfig } from '../../src/config.js';

const run = process.env.RUN_E2E_MCP === 'true';
const testFn = run ? it : it.skip;

describe('MCP tool e2e (optional, live Socrata)', () => {
  const config: ServerConfig = {
    domains: [
      {
        domain: 'data.cityofnewyork.us',
        auth: process.env.SODA_APP_TOKEN
          ? { mode: 'appToken', appToken: process.env.SODA_APP_TOKEN }
          : { mode: 'none' },
      },
    ],
  };

  testFn(
    'query_dataset returns rows from NYC 311 dataset',
    async () => {
      const registry = createClientRegistry(config);
      const client = getClient(registry, 'data.cityofnewyork.us');

      const res = await queryDataset(client, {
        domain: 'data.cityofnewyork.us',
        uid: 'nc67-uf89',
        limit: 5,
      });

      const data = (res as any).data ?? res;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    },
    30000,
  );
});
