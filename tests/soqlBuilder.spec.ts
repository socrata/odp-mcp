import { describe, it, expect } from 'vitest';
import {
  buildSoqlQuery,
  buildSoqlParams,
  validateField,
  sanitizeValue,
  type SelectField,
  type WhereCondition,
} from '../src/soqlBuilder.js';

describe('buildSoqlQuery', () => {
  describe('basic queries', () => {
    it('builds a select with limit and offset', () => {
      const query = buildSoqlQuery({ select: ['col1', 'col2'], limit: 10, offset: 5 });
      expect(query).toContain('SELECT col1, col2');
      expect(query).toContain('LIMIT 10');
      expect(query).toContain('OFFSET 5');
    });

    it('returns empty string when no params provided', () => {
      expect(buildSoqlQuery({})).toBe('');
    });

    it('accepts order clauses with ASC/DESC modifiers', () => {
      const query = buildSoqlQuery({ order: ['created_date DESC', 'name ASC'] });
      expect(query).toBe('ORDER BY created_date DESC, name ASC');
    });

    it('accepts order clauses without modifiers', () => {
      const query = buildSoqlQuery({ order: ['created_date', 'name'] });
      expect(query).toBe('ORDER BY created_date, name');
    });
  });

  describe('aggregate functions', () => {
    it('builds select with sum aggregate', () => {
      const select: SelectField[] = [{ column: 'amount', function: 'sum', alias: 'total_amount' }];
      const query = buildSoqlQuery({ select });
      expect(query).toBe('SELECT sum(amount) AS total_amount');
    });

    it('builds select with count aggregate', () => {
      const select: SelectField[] = [{ column: 'id', function: 'count', alias: 'count' }];
      const query = buildSoqlQuery({ select });
      expect(query).toBe('SELECT count(id) AS count');
    });

    it('builds select with multiple aggregates', () => {
      const select: SelectField[] = [
        { column: 'amount', function: 'sum', alias: 'total' },
        { column: 'amount', function: 'avg', alias: 'average' },
        { column: 'amount', function: 'max', alias: 'maximum' },
      ];
      const query = buildSoqlQuery({ select });
      expect(query).toBe('SELECT sum(amount) AS total, avg(amount) AS average, max(amount) AS maximum');
    });

    it('builds aggregate with group by', () => {
      const select: (SelectField | string)[] = [
        'borough',
        { column: 'unique_key', function: 'count', alias: 'complaint_count' },
      ];
      const query = buildSoqlQuery({ select, group: ['borough'] });
      expect(query).toContain('SELECT borough, count(unique_key) AS complaint_count');
      expect(query).toContain('GROUP BY borough');
    });
  });

  describe('transform functions', () => {
    it('builds select with upper transform', () => {
      const select: SelectField[] = [{ column: 'name', function: 'upper', alias: 'upper_name' }];
      const query = buildSoqlQuery({ select });
      expect(query).toBe('SELECT upper(name) AS upper_name');
    });

    it('builds select with date_trunc_ym', () => {
      const select: SelectField[] = [{ column: 'created_date', function: 'date_trunc_ym', alias: 'month' }];
      const query = buildSoqlQuery({ select, group: ['month'] });
      expect(query).toContain('SELECT date_trunc_ym(created_date) AS month');
    });
  });

  describe('structured WHERE conditions', () => {
    it('builds simple equality condition', () => {
      const where: WhereCondition = { field: 'borough', value: 'MANHATTAN' };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE borough = 'MANHATTAN'");
    });

    it('builds condition with comparison operator', () => {
      const where: WhereCondition = { field: 'count', operator: '>', value: 100, valueIsNumeric: true };
      const query = buildSoqlQuery({ where });
      expect(query).toBe('WHERE count > 100');
    });

    it('builds BETWEEN condition', () => {
      const where: WhereCondition = {
        field: 'amount',
        operator: 'between',
        value: '10',
        value2: '100',
      };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE amount BETWEEN '10' AND '100'");
    });

    it('builds numeric BETWEEN condition', () => {
      const where: WhereCondition = {
        field: 'amount',
        operator: 'between',
        value: 10,
        value2: 100,
        valueIsNumeric: true,
      };
      const query = buildSoqlQuery({ where });
      expect(query).toBe('WHERE amount BETWEEN 10 AND 100');
    });

    it('builds IN condition', () => {
      const where: WhereCondition = {
        field: 'status',
        operator: 'in',
        values: ['open', 'pending', 'closed'],
      };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE status IN ('open', 'pending', 'closed')");
    });

    it('builds NOT IN condition', () => {
      const where: WhereCondition = {
        field: 'status',
        operator: 'not in',
        values: ['deleted', 'archived'],
      };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE status NOT IN ('deleted', 'archived')");
    });

    it('builds IS NULL condition', () => {
      const where: WhereCondition = { field: 'closed_date', operator: 'is null', value: null };
      const query = buildSoqlQuery({ where });
      expect(query).toBe('WHERE closed_date IS NULL');
    });

    it('builds IS NOT NULL condition', () => {
      const where: WhereCondition = { field: 'closed_date', operator: 'is not null', value: null };
      const query = buildSoqlQuery({ where });
      expect(query).toBe('WHERE closed_date IS NOT NULL');
    });

    it('handles null value with equality operator as IS NULL', () => {
      const where: WhereCondition = { field: 'closed_date', value: null };
      const query = buildSoqlQuery({ where });
      expect(query).toBe('WHERE closed_date IS NULL');
    });

    it('handles null value with != operator as IS NOT NULL', () => {
      const where: WhereCondition = { field: 'closed_date', operator: '!=', value: null };
      const query = buildSoqlQuery({ where });
      expect(query).toBe('WHERE closed_date IS NOT NULL');
    });

    it('builds starts_with condition', () => {
      const where: WhereCondition = { field: 'name', operator: 'starts_with', value: 'John' };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE starts_with(name, 'John')");
    });

    it('builds contains condition', () => {
      const where: WhereCondition = { field: 'description', operator: 'contains', value: 'urgent' };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE contains(description, 'urgent')");
    });

    it('builds LIKE condition', () => {
      const where: WhereCondition = { field: 'name', operator: 'like', value: '%Smith%' };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE name like '%Smith%'");
    });

    it('builds condition with column function', () => {
      const where: WhereCondition = {
        field: 'name',
        columnFunction: 'upper',
        value: 'JOHN',
      };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE upper(name) = 'JOHN'");
    });

    it('builds condition with value function', () => {
      const where: WhereCondition = {
        field: 'name',
        columnFunction: 'upper',
        valueFunction: 'upper',
        value: 'john',
      };
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE upper(name) = upper('john')");
    });

    it('builds multiple conditions with AND', () => {
      const where: WhereCondition[] = [
        { field: 'borough', value: 'MANHATTAN', booleanType: 'AND' },
        { field: 'status', value: 'Open' },
      ];
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE (borough = 'MANHATTAN') AND (status = 'Open')");
    });

    it('builds multiple conditions with OR', () => {
      const where: WhereCondition[] = [
        { field: 'borough', value: 'MANHATTAN', booleanType: 'OR' },
        { field: 'borough', value: 'BROOKLYN' },
      ];
      const query = buildSoqlQuery({ where });
      expect(query).toBe("WHERE (borough = 'MANHATTAN') OR (borough = 'BROOKLYN')");
    });
  });

  describe('full-text search', () => {
    it('builds search clause', () => {
      const query = buildSoqlQuery({ search: 'noise complaint' });
      expect(query).toBe("SEARCH 'noise complaint'");
    });

    it('escapes quotes in search term', () => {
      const query = buildSoqlQuery({ search: "O'Brien" });
      expect(query).toBe("SEARCH 'O''Brien'");
    });
  });

  describe('security - validation', () => {
    it('rejects unsafe order clauses', () => {
      expect(() => buildSoqlQuery({ order: ['name; DROP TABLE'] })).toThrow('Unsafe order clause');
      expect(() => buildSoqlQuery({ order: ['name --comment'] })).toThrow('Unsafe order clause');
      expect(() => buildSoqlQuery({ order: ['name INVALID'] })).toThrow('Unsafe order clause');
    });

    it('rejects unsafe identifiers in select', () => {
      expect(() => buildSoqlQuery({ select: ['col; DROP'] })).toThrow();
    });

    it('rejects unsafe where clauses (raw string)', () => {
      expect(() => buildSoqlQuery({ where: "name = 'test'; --" })).toThrow('Unsafe where');
      expect(() => buildSoqlQuery({ where: "name = 'test' /* comment */" })).toThrow('Unsafe where');
    });

    it('rejects SQL injection patterns in where clause', () => {
      // UNION attacks
      expect(() => buildSoqlQuery({ where: '1=1 UNION SELECT * FROM users' })).toThrow('Unsafe where');
      // DROP statements
      expect(() => buildSoqlQuery({ where: '1=1; DROP TABLE users' })).toThrow('Unsafe where');
      // DELETE statements
      expect(() => buildSoqlQuery({ where: '1=1 OR DELETE FROM users' })).toThrow('Unsafe where');
      // String concatenation
      expect(() => buildSoqlQuery({ where: "name = 'a' || 'b'" })).toThrow('Unsafe where');
      // Hex-encoded strings
      expect(() => buildSoqlQuery({ where: 'name = 0x41424344' })).toThrow('Unsafe where');
      // CHAR obfuscation
      expect(() => buildSoqlQuery({ where: 'name = CHAR(65)' })).toThrow('Unsafe where');
    });

    it('allows safe text containing keywords inside quotes', () => {
      expect(() => buildSoqlQuery({ where: "incident_address LIKE 'Union Square%'" })).not.toThrow();
    });

    it('accepts valid raw where clauses', () => {
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
});

describe('buildSoqlParams', () => {
  it('builds params object with $ prefixes', () => {
    const params = buildSoqlParams({
      select: ['col1', 'col2'],
      where: "status = 'active'",
      limit: 100,
      offset: 50,
    });
    expect(params.$select).toBe('col1, col2');
    expect(params.$where).toBe("status = 'active'");
    expect(params.$limit).toBe('100');
    expect(params.$offset).toBe('50');
  });

  it('builds $q for full-text search', () => {
    const params = buildSoqlParams({ search: 'test query' });
    expect(params.$q).toBe('test query');
  });

  it('builds $group and $order', () => {
    const params = buildSoqlParams({
      group: ['borough'],
      order: ['count DESC'],
    });
    expect(params.$group).toBe('borough');
    expect(params.$order).toBe('count DESC');
  });
});

describe('validateField', () => {
  it('accepts valid field names', () => {
    expect(() => validateField('column_name')).not.toThrow();
    expect(() => validateField('Column123')).not.toThrow();
    expect(() => validateField('_private')).not.toThrow();
    expect(() => validateField('@computed_field')).not.toThrow();
  });

  it('accepts wildcard', () => {
    expect(() => validateField('*')).not.toThrow();
  });

  it('rejects invalid field names', () => {
    expect(() => validateField('name; DROP')).toThrow();
    expect(() => validateField('')).toThrow();
    expect(() => validateField('123start')).toThrow();
  });
});

describe('sanitizeValue', () => {
  it('escapes single quotes', () => {
    expect(sanitizeValue("O'Brien")).toBe("O''Brien");
    expect(sanitizeValue("It's a test")).toBe("It''s a test");
  });

  it('handles null/undefined', () => {
    expect(sanitizeValue(null)).toBe('NULL');
    expect(sanitizeValue(undefined)).toBe('NULL');
  });

  it('converts numbers to strings', () => {
    expect(sanitizeValue(123)).toBe('123');
    expect(sanitizeValue(45.67)).toBe('45.67');
  });
});
