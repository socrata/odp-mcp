import { describe, it, expect } from 'vitest';
import { buildSoqlQuery } from '../src/soqlBuilder.js';

describe('buildSoql', () => {
  it('builds a select with limit and offset', () => {
    const query = buildSoqlQuery({ select: ['col1', 'col2'], limit: 10, offset: 5 });
    expect(query).toContain('select col1, col2');
    expect(query).toContain('limit 10');
    expect(query).toContain('offset 5');
  });

  it('returns empty string when no params provided', () => {
    expect(buildSoqlQuery({})).toBe('');
  });
});
