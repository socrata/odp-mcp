import { HttpClient, type HttpClientOptions } from './httpClient.js';
import type { ServerConfig, DomainConfig } from './config.js';

// Build HTTP client options from server config
function buildClientOptions(config: ServerConfig): HttpClientOptions {
  return {
    timeoutMs: config.httpTimeoutMs,
    maxRetries: config.httpMaxRetries,
    retryBaseMs: config.httpRetryBaseMs,
  };
}

// Registry with reference to server config for lazy client creation
interface ClientRegistry {
  clients: Map<string, HttpClient>;
  config: ServerConfig;
}

// Simple client registry keyed by domain; lazily creates clients for new domains.
export function createClientRegistry(config: ServerConfig): ClientRegistry {
  const clients = new Map<string, HttpClient>();
  const clientOptions = buildClientOptions(config);

  config.domains.forEach((domainCfg: DomainConfig) => {
    clients.set(normalize(domainCfg.domain), new HttpClient(domainCfg, clientOptions));
  });

  return { clients, config };
}

export function getClient(registry: ClientRegistry, domain: string): HttpClient {
  const key = normalize(domain);
  const existing = registry.clients.get(key);
  if (existing) return existing;

  // Fallback: allow any domain, using global env defaults (app token, rate limits) if present.
  const envAppToken = process.env.SODA_APP_TOKEN;
  const envRate = process.env.SODA_REQUESTS_PER_HOUR ? Number(process.env.SODA_REQUESTS_PER_HOUR) : undefined;

  const cfg: DomainConfig = {
    domain: key,
    auth: envAppToken ? { mode: 'appToken', appToken: envAppToken } : { mode: 'none' },
    limits: envRate ? { requestsPerHour: envRate } : undefined,
  };

  const clientOptions = buildClientOptions(registry.config);
  const client = new HttpClient(cfg, clientOptions);
  registry.clients.set(key, client);
  return client;
}

function normalize(domain: string): string {
  return domain.trim().toLowerCase();
}
