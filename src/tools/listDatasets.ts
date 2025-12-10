import type { HttpClient } from '../httpClient.js';
import { authFromInput, type AuthOverrideInput } from '../auth.js';

export interface ListDatasetsInput extends AuthOverrideInput {
  domain: string;
  query?: string;
  limit?: number;
}

export interface EnrichedDataset {
  id: string;
  name?: string;
  metadata: Record<string, unknown>;
  columns: unknown[];
  previewRows: unknown[];
}

export interface ListDatasetsResult {
  datasets: EnrichedDataset[];
}

// Maximum concurrent requests when enriching datasets
const MAX_CONCURRENT_ENRICHMENTS = 5;

export async function listDatasets(client: HttpClient, input: ListDatasetsInput) {
  const path = `/api/catalog/v1`;
  const params = {
    q: input.query ?? '',
    limit: input.limit ?? 20,
    domains: input.domain,
  };

  // Initial catalog search
  const authOverride = authFromInput(input);
  const search = await client.request<CatalogSearchResponse>({ method: 'GET', path, query: params, authOverride });
  const results = search.data?.results ?? [];

  // Extract valid dataset IDs and names
  const datasetEntries = results
    .filter((entry): entry is CatalogEntry & { resource: { id: string } } => !!entry?.resource?.id)
    .map((entry) => ({ id: entry.resource.id, name: entry.resource?.name }));

  // Fetch metadata and preview rows in parallel (with concurrency limit)
  const datasets = await enrichDatasetsParallel(client, datasetEntries, authOverride, MAX_CONCURRENT_ENRICHMENTS);

  return {
    status: 200,
    headers: {},
    data: { datasets } satisfies ListDatasetsResult,
  };
}

interface CatalogEntry {
  resource?: {
    id?: string;
    name?: string;
  };
}

interface CatalogSearchResponse {
  results?: CatalogEntry[];
}

interface DatasetEntry {
  id: string;
  name?: string;
}

async function enrichDatasetsParallel(
  client: HttpClient,
  entries: DatasetEntry[],
  authOverride: ReturnType<typeof authFromInput>,
  concurrency: number,
): Promise<EnrichedDataset[]> {
  const results: EnrichedDataset[] = [];

  // Process in batches to limit concurrent requests
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((entry) => enrichDataset(client, entry, authOverride)),
    );
    results.push(...batchResults);
  }

  return results;
}

async function enrichDataset(
  client: HttpClient,
  entry: DatasetEntry,
  authOverride: ReturnType<typeof authFromInput>,
): Promise<EnrichedDataset> {
  // Fetch metadata and preview rows in parallel for each dataset
  const [metaRes, rowsRes] = await Promise.all([
    client.request<Record<string, unknown>>({
      method: 'GET',
      path: `/api/views/${entry.id}.json`,
      authOverride,
    }),
    client.request<unknown[]>({
      method: 'GET',
      path: `/resource/${entry.id}.json`,
      query: { $limit: 10 },
      authOverride,
    }),
  ]);

  const metadata = metaRes.data ?? {};
  const columns = (metadata.columns as unknown[]) ?? [];

  return {
    id: entry.id,
    name: entry.name,
    metadata,
    columns,
    previewRows: rowsRes.data ?? [],
  };
}
