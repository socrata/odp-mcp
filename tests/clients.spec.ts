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

  it('throws on unknown domain', () => {
    const registry = createClientRegistry(config);
    expect(() => getClient(registry, 'unknown.domain')).toThrow(/Unknown domain/);
  });
});
