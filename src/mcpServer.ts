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
// Note: This is a best-effort mapper; consumers should prefer the Zod schema directly when available.
type ZodLike = { _def?: { typeName?: string; description?: string; innerType?: ZodLike; type?: ZodLike; schema?: ZodLike } };

function unwrap(zod: ZodLike | undefined): ZodLike | undefined {
  let current = zod;
  while (current?._def) {
    const typeName = current._def.typeName;
    if (typeName === 'ZodOptional' || typeName === 'ZodNullable' || typeName === 'ZodDefault' || typeName === 'ZodEffects') {
      current = (current._def.innerType ?? current._def.type ?? current._def.schema) as ZodLike | undefined;
      continue;
    }
    break;
  }
  return current;
}

function isOptionalish(zod: ZodLike | undefined): boolean {
  const typeName = zod?._def?.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodNullable' || typeName === 'ZodDefault';
}

function jsonSchemaForZod(zod: ZodLike | undefined): Record<string, unknown> {
  const unwrapped = unwrap(zod);
  const typeName = unwrapped?._def?.typeName;

  const description = zod?._def?.description ?? unwrapped?._def?.description;

  if (typeName === 'ZodString') return { type: 'string', description };
  if (typeName === 'ZodNumber') return { type: 'number', description };
  if (typeName === 'ZodBoolean') return { type: 'boolean', description };
  if (typeName === 'ZodArray') {
    const itemType = (unwrapped?._def as any)?.type as ZodLike | undefined;
    return { type: 'array', items: jsonSchemaForZod(itemType), description };
  }
  if (typeName === 'ZodObject') return { type: 'object', description };

  // Fallback
  return { type: 'string', description };
}

function zodToJsonSchema(zodSchema: { shape: Record<string, unknown> }): object {
  const shape = zodSchema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as ZodLike;
    if (!isOptionalish(zodType)) {
      required.push(key);
    }
    properties[key] = jsonSchemaForZod(zodType);
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
    get_metadata: async (input) =>
      getMetadata(
        getClient(registry, input.domain as string),
        input as unknown as Parameters<typeof getMetadata>[1],
        { cacheTtlMs: config.cacheTtlMs },
      ),
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
