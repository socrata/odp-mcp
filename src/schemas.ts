import { DEFAULT_MAX_LIMIT, DEFAULT_PREVIEW_LIMIT, DEFAULT_DEFAULT_LIMIT, DEFAULT_MAX_OFFSET } from './limits.js';

export const listDatasetsSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    query: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: DEFAULT_MAX_LIMIT },
    appToken: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
    bearerToken: { type: 'string' },
  },
  required: ['domain'],
  additionalProperties: false,
} as const;

export const getMetadataSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    uid: { type: 'string' },
    appToken: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
    bearerToken: { type: 'string' },
  },
  required: ['domain', 'uid'],
  additionalProperties: false,
} as const;

export const previewDatasetSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    uid: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: DEFAULT_MAX_LIMIT, default: DEFAULT_PREVIEW_LIMIT },
    appToken: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
    bearerToken: { type: 'string' },
  },
  required: ['domain', 'uid'],
  additionalProperties: false,
} as const;

export const queryDatasetSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    uid: { type: 'string' },
    select: { type: 'array', items: { type: 'string' } },
    where: { type: 'string' },
    order: { type: 'array', items: { type: 'string' } },
    group: { type: 'array', items: { type: 'string' } },
    having: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: DEFAULT_MAX_LIMIT, default: DEFAULT_DEFAULT_LIMIT },
    offset: { type: 'integer', minimum: 0, maximum: DEFAULT_MAX_OFFSET, default: 0 },
    appToken: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
    bearerToken: { type: 'string' },
  },
  required: ['domain', 'uid'],
  additionalProperties: false,
} as const;
