import type { DomainConfig } from './config.js';

export interface AuthOverrideInput {
  appToken?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
}

/**
 * Builds an auth override from tool input parameters.
 * Returns undefined if no auth credentials are provided.
 */
export function authFromInput(input: AuthOverrideInput): DomainConfig['auth'] | undefined {
  if (input.appToken) {
    return { mode: 'appToken', appToken: input.appToken };
  }
  if (input.username && input.password) {
    return { mode: 'basic', username: input.username, password: input.password };
  }
  if (input.bearerToken) {
    return { mode: 'oauth2', bearerToken: input.bearerToken };
  }
  return undefined;
}
