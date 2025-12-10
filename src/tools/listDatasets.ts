import type { HttpClient } from '../httpClient.js';

export interface ListDatasetsInput {
  domain: string;
  query?: string;
  limit?: number;
  appToken?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
}

export interface EnrichedDataset {
  id: string;
  name?: string;
  metadata: any;
  columns: any[];
  previewRows: any[];
}

export interface ListDatasetsResult {
  datasets: EnrichedDataset[];
}

export async function listDatasets(client: HttpClient, input: ListDatasetsInput) {
  const path = `/api/catalog/v1`;
  const params = {
    q: input.query ?? '',
    limit: input.limit ?? 20,
    domains: input.domain,
  };

  // Initial catalog search
  const authOverride = authFromInput(input);
  const search = await client.request<any>({ method: 'GET', path, query: params, authOverride });
  const results = search.data?.results ?? [];

  const datasets: EnrichedDataset[] = [];

  for (const entry of results) {
    const id = entry?.resource?.id;
    if (!id) continue;

    // Fetch metadata
    const metaRes = await client.request<any>({ method: 'GET', path: `/api/views/${id}.json`, authOverride });
    const metadata = metaRes.data ?? {};
    const columns = metadata.columns ?? [];

    // Fetch preview rows (first 10)
    const rowsRes = await client.request<any>({
      method: 'GET',
      path: `/resource/${id}.json`,
      query: { $limit: 10 },
      authOverride,
    });

    datasets.push({
      id,
      name: entry?.resource?.name,
      metadata,
      columns,
      previewRows: rowsRes.data ?? [],
    });
  }

  return {
    status: 200,
    headers: {},
    data: { datasets } satisfies ListDatasetsResult,
  };
}

function authFromInput(input: { appToken?: string; username?: string; password?: string; bearerToken?: string }) {
  if (input.appToken) return { mode: 'appToken' as const, appToken: input.appToken };
  if (input.username && input.password) return { mode: 'basic' as const, username: input.username, password: input.password };
  if (input.bearerToken) return { mode: 'oauth2' as const, bearerToken: input.bearerToken };
  return undefined;
}
