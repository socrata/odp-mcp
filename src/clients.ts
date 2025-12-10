import { HttpClient } from './httpClient.js';
import type { ServerConfig, DomainConfig } from './config.js';

// Simple client registry keyed by domain; lazily creates clients for new domains.
export function createClientRegistry(config: ServerConfig): Map<string, HttpClient> {
  const registry = new Map<string, HttpClient>();
  config.domains.forEach((domainCfg: DomainConfig) => {
    registry.set(normalize(domainCfg.domain), new HttpClient(domainCfg));
  });
  return registry;
}

export function getClient(registry: Map<string, HttpClient>, domain: string): HttpClient {
  const key = normalize(domain);
  const existing = registry.get(key);
  if (existing) return existing;

  // Fallback: allow any domain, using global env defaults (app token, rate limits) if present.
  const envAppToken = process.env.SODA_APP_TOKEN;
  const envRate = process.env.SODA_REQUESTS_PER_HOUR ? Number(process.env.SODA_REQUESTS_PER_HOUR) : undefined;

  const cfg: DomainConfig = {
    domain: key,
    auth: envAppToken ? { mode: 'appToken', appToken: envAppToken } : { mode: 'none' },
    limits: envRate ? { requestsPerHour: envRate } : undefined,
  };

  const client = new HttpClient(cfg);
  registry.set(key, client);
  return client;
}

function normalize(domain: string): string {
  return domain.trim().toLowerCase();
}
