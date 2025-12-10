// Configuration shapes for the MCP SODA server. Values are loaded from env or a JSON config file.
export type AuthMode = 'none' | 'appToken' | 'basic' | 'oauth2';

export interface DomainConfig {
  domain: string; // e.g., "data.cityofnewyork.us"
  auth: {
    mode: AuthMode;
    appToken?: string;
    username?: string; // for basic
    password?: string; // for basic
    bearerToken?: string; // for oauth2
  };
  // Optional per-domain rate and paging constraints
  limits?: {
    requestsPerHour?: number;
    maxLimit?: number; // cap user-supplied $limit
  };
}

export interface ServerConfig {
  domains: DomainConfig[];
  defaultLimit?: number; // fallback $limit for preview/query
  maxOffset?: number; // clamp large scans
  cacheTtlMs?: number; // metadata cache
}

// Loads config from environment variables:
// - SODA_DOMAINS: comma-separated list of domains
// - SODA_APP_TOKEN: optional app token applied to all domains
// - SODA_REQUESTS_PER_HOUR: optional numeric rate
// You can replace this with a JSON config file loader later.
export function loadConfig(): ServerConfig {
  const domainsEnv = process.env.SODA_DOMAINS;
  const appToken = process.env.SODA_APP_TOKEN;
  const rate = process.env.SODA_REQUESTS_PER_HOUR ? Number(process.env.SODA_REQUESTS_PER_HOUR) : undefined;

  const domains: DomainConfig[] = domainsEnv
    ? domainsEnv
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((domain) => ({
          domain,
          auth: appToken ? { mode: 'appToken', appToken } : { mode: 'none' },
          limits: rate ? { requestsPerHour: rate } : undefined,
        }))
    : [];

  return {
    domains,
    defaultLimit: 500,
    maxOffset: 50000,
    cacheTtlMs: 5 * 60 * 1000,
  };
}
