// Minimal MCP-style registration scaffold. This does not start a transport; it bundles tool definitions
// and handlers so a caller can wire them into @modelcontextprotocol/sdk or a custom runtime.
import { createClientRegistry, getClient } from './clients.js';
import type { ServerConfig } from './config.js';
import { listDatasets } from './tools/listDatasets.js';
import { getMetadata } from './tools/getMetadata.js';
import { previewDataset } from './tools/previewDataset.js';
import { queryDataset } from './tools/queryDataset.js';
import {
  listDatasetsSchema,
  getMetadataSchema,
  previewDatasetSchema,
  queryDatasetSchema,
} from './schemas.js';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: object;
  handler: (input: any) => Promise<unknown>;
}

export function createTools(config: ServerConfig): ToolDefinition[] {
  const registry = createClientRegistry(config);

  return [
    {
      name: 'list_datasets',
      description: 'Search datasets on a configured Socrata domain',
      schema: listDatasetsSchema,
      handler: async (input) => listDatasets(getClient(registry, input.domain), input),
    },
    {
      name: 'get_metadata',
      description: 'Fetch dataset metadata (columns, types, updated at)',
      schema: getMetadataSchema,
      handler: async (input) => getMetadata(getClient(registry, input.domain), input),
    },
    {
      name: 'preview_dataset',
      description: 'Preview first N rows of a dataset',
      schema: previewDatasetSchema,
      handler: async (input) => previewDataset(getClient(registry, input.domain), input),
    },
    {
      name: 'query_dataset',
      description: 'Run a structured SoQL query against a dataset',
      schema: queryDatasetSchema,
      handler: async (input) => queryDataset(getClient(registry, input.domain), input),
    },
  ];
}
