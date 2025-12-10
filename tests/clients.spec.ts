import { describe, it, expect } from 'vitest';
import { createClientRegistry, getClient } from '../src/clients.js';
import type { ServerConfig } from '../src/config.js';

const config: ServerConfig = {
  domains: [
    { domain: 'data.cityofnewyork.us', auth: { mode: 'none' } },
    { domain: 'data.sfgov.org', auth: { mode: 'appToken', appToken: 'token' } },
  ],
};

describe('client registry', () => {
  it('creates registry and resolves known domain', () => {
    const registry = createClientRegistry(config);
    const client = getClient(registry, 'data.cityofnewyork.us');
    expect(client).toBeDefined();
  });

  it('lazily creates client for unknown domain with env defaults', () => {
    const registry = createClientRegistry(config);
    const client = getClient(registry, 'unknown.domain');
    expect(client).toBeDefined();
    // subsequent lookups use the same instance
    const again = getClient(registry, 'unknown.domain');
    expect(again).toBe(client);
  });
});
