// Minimal MCP-style registration scaffold. This does not start a transport; it bundles tool definitions
// and handlers so a caller can wire them into @modelcontextprotocol/sdk or a custom runtime.
import { createClientRegistry, getClient } from './clients.js';
import type { ServerConfig } from './config.js';
import { listDatasets } from './tools/listDatasets.js';
import { getMetadata } from './tools/getMetadata.js';
import { previewDataset } from './tools/previewDataset.js';
import { queryDataset } from './tools/queryDataset.js';
import { toolDefinitions, type ToolName } from './toolDefinitions.js';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: object;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

// Convert Zod schema to JSON Schema format for custom runtimes
function zodToJsonSchema(zodSchema: { shape: Record<string, unknown> }): object {
  // The MCP SDK handles Zod schemas directly, but for custom runtimes
  // we provide a simplified JSON schema representation
  const shape = zodSchema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as { _def?: { typeName?: string; description?: string } };
    const isOptional = zodType._def?.typeName === 'ZodOptional';

    if (!isOptional) {
      required.push(key);
    }

    // Simplified type mapping - custom runtimes should use the Zod schema directly if possible
    properties[key] = {
      type: 'string', // Default fallback
      description: zodType._def?.description,
    };
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

export function createTools(config: ServerConfig): ToolDefinition[] {
  const registry = createClientRegistry(config);

  const toolHandlers: Record<ToolName, (input: Record<string, unknown>) => Promise<unknown>> = {
    list_datasets: async (input) => listDatasets(getClient(registry, input.domain as string), input as unknown as Parameters<typeof listDatasets>[1]),
    get_metadata: async (input) => getMetadata(getClient(registry, input.domain as string), input as unknown as Parameters<typeof getMetadata>[1]),
    preview_dataset: async (input) => previewDataset(getClient(registry, input.domain as string), input as unknown as Parameters<typeof previewDataset>[1]),
    query_dataset: async (input) => queryDataset(getClient(registry, input.domain as string), input as unknown as Parameters<typeof queryDataset>[1]),
  };

  return (Object.keys(toolDefinitions) as ToolName[]).map((name) => ({
    name,
    description: toolDefinitions[name].description,
    schema: zodToJsonSchema(toolDefinitions[name].schema),
    handler: toolHandlers[name],
  }));
}

// Export unified definitions for direct Zod access
export { toolDefinitions } from './toolDefinitions.js';
