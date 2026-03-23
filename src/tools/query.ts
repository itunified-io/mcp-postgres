import { z } from 'zod';
import type { PostgresClient } from '../client/postgres-client.js';
import { ConfirmSchema, CoercedBooleanSchema, IdentifierSchema } from '../utils/validation.js';

const QuerySchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
  params: z.array(z.unknown()).optional(),
});

const ExplainSchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
  params: z.array(z.unknown()).optional(),
  mode: z.enum(['plan', 'analyze']).default('plan'),
  confirm: CoercedBooleanSchema.optional(),
}).refine(
  (data) => data.mode !== 'analyze' || data.confirm === true,
  { message: 'EXPLAIN ANALYZE executes the statement. Set confirm: true to proceed.', path: ['confirm'] },
);

export { ExplainSchema as _ExplainSchema };

const PreparedSchema = z.object({
  action: z.enum(['prepare', 'execute', 'deallocate']),
  name: IdentifierSchema,
  sql: z.string().optional(),
  params: z.array(z.unknown()).optional(),
});

export { PreparedSchema as _PreparedSchema };

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export const queryToolDefinitions = [
  {
    name: 'pg_query',
    description: 'Execute a parameterized SQL query. Returns rows as JSON. Use $1, $2, ... for parameters.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql: { type: 'string', description: 'SQL query with $1, $2, ... placeholders' },
        params: { type: 'array', items: {}, description: 'Parameter values for placeholders' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'pg_query_explain',
    description: 'Run EXPLAIN on a query. mode=plan (default, safe) shows the plan without executing. mode=analyze executes the statement and shows actual timing — ALWAYS requires confirm: true because EXPLAIN ANALYZE executes the statement.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql: { type: 'string', description: 'SQL query to explain' },
        params: { type: 'array', items: {}, description: 'Parameter values' },
        mode: { type: 'string', enum: ['plan', 'analyze'], description: "Explain mode: 'plan' (safe, default) or 'analyze' (executes statement, requires confirm)" },
        confirm: { type: 'boolean', description: 'Required for mode=analyze. EXPLAIN ANALYZE executes the statement.' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'pg_query_prepared',
    description: '[DEPRECATED] Manage named prepared statements: PREPARE, EXECUTE, DEALLOCATE. ⚠️ Prepared statements are session-local in PostgreSQL and unreliable with connection pools — each pool checkout may get a different backend. Use parameterized pg_query instead.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', enum: ['prepare', 'execute', 'deallocate'], description: 'Action to perform' },
        name: { type: 'string', description: 'Prepared statement name (SQL identifier: letters, digits, underscores)' },
        sql: { type: 'string', description: 'SQL query (required for prepare)' },
        params: { type: 'array', items: {}, description: 'Parameters (for execute)' },
      },
      required: ['action', 'name'],
    },
  },
];

export async function handleQueryTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_query': {
        const { sql, params } = QuerySchema.parse(args);
        const result = await client.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify({ rows: result.rows, rowCount: result.rowCount, command: result.command }, null, 2) }] };
      }

      case 'pg_query_explain': {
        const { sql, params, mode } = ExplainSchema.parse(args);
        const explainPrefix = mode === 'analyze' ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
        const result = await client.query(`${explainPrefix} ${sql}`, params);
        const plan = result.rows.map((r) => Object.values(r)[0]).join('\n');
        return { content: [{ type: 'text', text: plan }] };
      }

      case 'pg_query_prepared': {
        const { action, name: stmtName, sql, params } = PreparedSchema.parse(args);
        const quotedName = quoteIdent(stmtName);
        switch (action) {
          case 'prepare': {
            if (!sql) return { content: [{ type: 'text', text: 'Error: sql is required for prepare action' }] };
            await client.query(`PREPARE ${quotedName} AS ${sql}`);
            return { content: [{ type: 'text', text: `Prepared statement '${stmtName}' created.` }] };
          }
          case 'execute': {
            const paramList = params && params.length > 0 ? `(${params.map((_, i) => `$${i + 1}`).join(', ')})` : '';
            const result = await client.query(`EXECUTE ${quotedName}${paramList}`, params);
            return { content: [{ type: 'text', text: JSON.stringify({ rows: result.rows, rowCount: result.rowCount }, null, 2) }] };
          }
          case 'deallocate': {
            await client.query(`DEALLOCATE ${quotedName}`);
            return { content: [{ type: 'text', text: `Prepared statement '${stmtName}' deallocated.` }] };
          }
        }
        break;
      }

      default:
        return { content: [{ type: 'text', text: `Unknown query tool: ${name}` }] };
    }
    return { content: [{ type: 'text', text: `Unknown query tool: ${name}` }] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
