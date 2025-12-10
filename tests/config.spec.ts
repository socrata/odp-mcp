import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

const originalEnv = { ...process.env };

describe('loadConfig', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns empty domains when env not set', () => {
    delete process.env.SODA_DOMAINS;
    const config = loadConfig();
    expect(config.domains.length).toBe(0);
  });

  it('parses domains and app token from env', () => {
    process.env.SODA_DOMAINS = 'data.cityofnewyork.us, data.sfgov.org';
    process.env.SODA_APP_TOKEN = 'token123';
    process.env.SODA_REQUESTS_PER_HOUR = '500';

    const config = loadConfig();
    expect(config.domains.length).toBe(2);
    expect(config.domains[0].auth.appToken).toBe('token123');
    expect(config.domains[0].limits?.requestsPerHour).toBe(500);
  });
});
