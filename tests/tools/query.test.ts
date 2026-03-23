import { describe, it, expect } from 'vitest';
import { _ExplainSchema as ExplainSchema, queryToolDefinitions } from '../../src/tools/query.js';
import { IdentifierSchema } from '../../src/utils/validation.js';

describe('pg_query_explain', () => {
  describe('ExplainSchema', () => {
    it('defaults mode to plan', () => {
      const result = ExplainSchema.parse({ sql: 'SELECT 1' });
      expect(result.mode).toBe('plan');
    });

    it('accepts mode=analyze with confirm=true', () => {
      const result = ExplainSchema.parse({ sql: 'SELECT 1', mode: 'analyze', confirm: true });
      expect(result.mode).toBe('analyze');
    });

    it('rejects mode=analyze without confirm', () => {
      expect(() => ExplainSchema.parse({ sql: 'SELECT 1', mode: 'analyze' }))
        .toThrow();
    });

    it('rejects mode=analyze with confirm=false', () => {
      expect(() => ExplainSchema.parse({ sql: 'SELECT 1', mode: 'analyze', confirm: false }))
        .toThrow();
    });

    it('does not require confirm for mode=plan', () => {
      const result = ExplainSchema.parse({ sql: 'SELECT 1', mode: 'plan' });
      expect(result.mode).toBe('plan');
    });
  });
});

describe('pg_query_prepared', () => {
  describe('statement name validation', () => {
    it('accepts valid SQL identifiers', () => {
      expect(() => IdentifierSchema.parse('my_statement')).not.toThrow();
      expect(() => IdentifierSchema.parse('stmt1')).not.toThrow();
      expect(() => IdentifierSchema.parse('_private')).not.toThrow();
    });

    it('rejects SQL injection in statement names', () => {
      expect(() => IdentifierSchema.parse("'; DROP TABLE x; --")).toThrow('Invalid SQL identifier');
      expect(() => IdentifierSchema.parse('Robert"); DROP TABLE students;--')).toThrow('Invalid SQL identifier');
      expect(() => IdentifierSchema.parse('stmt; DELETE FROM users')).toThrow('Invalid SQL identifier');
      expect(() => IdentifierSchema.parse('')).toThrow();
    });

    it('rejects identifiers longer than 63 chars', () => {
      expect(() => IdentifierSchema.parse('a'.repeat(64))).toThrow('63 characters');
    });
  });

  describe('deprecation', () => {
    it('tool description contains DEPRECATED warning', () => {
      const def = queryToolDefinitions.find(t => t.name === 'pg_query_prepared');
      expect(def?.description).toContain('DEPRECATED');
      expect(def?.description).toContain('session-local');
    });
  });
});
