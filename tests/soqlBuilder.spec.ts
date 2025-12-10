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

  it('rejects SQL injection patterns in where clause', () => {
    // UNION attacks
    expect(() => buildSoqlQuery({ where: "1=1 UNION SELECT * FROM users" })).toThrow('Unsafe where');
    // DROP statements
    expect(() => buildSoqlQuery({ where: "1=1; DROP TABLE users" })).toThrow('Unsafe where');
    // DELETE statements
    expect(() => buildSoqlQuery({ where: "1=1 OR DELETE FROM users" })).toThrow('Unsafe where');
    // String concatenation
    expect(() => buildSoqlQuery({ where: "name = 'a' || 'b'" })).toThrow('Unsafe where');
    // Hex-encoded strings
    expect(() => buildSoqlQuery({ where: "name = 0x41424344" })).toThrow('Unsafe where');
    // CHAR obfuscation
    expect(() => buildSoqlQuery({ where: "name = CHAR(65)" })).toThrow('Unsafe where');
  });

  it('allows safe text containing keywords inside quotes', () => {
    expect(() => buildSoqlQuery({ where: "incident_address LIKE 'Union Square%'" })).not.toThrow();
  });

  it('accepts valid where clauses', () => {
    // Simple equality
    expect(() => buildSoqlQuery({ where: "borough = 'MANHATTAN'" })).not.toThrow();
    // Comparison operators
    expect(() => buildSoqlQuery({ where: "count > 100 AND status = 'active'" })).not.toThrow();
    // LIKE patterns
    expect(() => buildSoqlQuery({ where: "name LIKE '%test%'" })).not.toThrow();
    // IN clauses
    expect(() => buildSoqlQuery({ where: "status IN ('open', 'closed')" })).not.toThrow();
    // Date comparisons
    expect(() => buildSoqlQuery({ where: "created_date > '2024-01-01'" })).not.toThrow();
  });
});
