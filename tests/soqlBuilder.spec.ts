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

  it('accepts order clauses with ASC/DESC modifiers', () => {
    const query = buildSoqlQuery({ order: ['created_date DESC', 'name ASC'] });
    expect(query).toBe('order by created_date DESC, name ASC');
  });

  it('accepts order clauses without modifiers', () => {
    const query = buildSoqlQuery({ order: ['created_date', 'name'] });
    expect(query).toBe('order by created_date, name');
  });

  it('rejects unsafe order clauses', () => {
    expect(() => buildSoqlQuery({ order: ['name; DROP TABLE'] })).toThrow('Unsafe order clause');
    expect(() => buildSoqlQuery({ order: ['name --comment'] })).toThrow('Unsafe order clause');
    expect(() => buildSoqlQuery({ order: ['name INVALID'] })).toThrow('Unsafe order clause');
  });

  it('rejects unsafe identifiers in select', () => {
    expect(() => buildSoqlQuery({ select: ['col; DROP'] })).toThrow('Unsafe identifier');
  });

  it('rejects unsafe where clauses', () => {
    expect(() => buildSoqlQuery({ where: "name = 'test'; --" })).toThrow('Unsafe where');
    expect(() => buildSoqlQuery({ where: "name = 'test' /* comment */" })).toThrow('Unsafe where');
  });
});
