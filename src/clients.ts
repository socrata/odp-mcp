import { HttpClient } from './httpClient.js';
import type { ServerConfig, DomainConfig } from './config.js';

// Simple client registry keyed by domain; throws when unknown.
export function createClientRegistry(config: ServerConfig): Map<string, HttpClient> {
  const registry = new Map<string, HttpClient>();
  config.domains.forEach((domainCfg: DomainConfig) => {
    registry.set(normalize(domainCfg.domain), new HttpClient(domainCfg));
  });
  return registry;
}

export function getClient(registry: Map<string, HttpClient>, domain: string): HttpClient {
  const client = registry.get(normalize(domain));
  if (!client) {
    throw new Error(`Unknown domain "${domain}". Configure it in server config.`);
  }
  return client;
}

function normalize(domain: string): string {
  return domain.trim().toLowerCase();
}
