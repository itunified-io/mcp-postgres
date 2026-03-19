import { z } from 'zod';
import type { PostgresClient } from '../client/postgres-client.js';

const QuerySchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
  params: z.array(z.unknown()).optional(),
});

const ExplainSchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
  params: z.array(z.unknown()).optional(),
});

const PreparedSchema = z.object({
  action: z.enum(['prepare', 'execute', 'deallocate']),
  name: z.string().min(1, 'Statement name is required'),
  sql: z.string().optional(),
  params: z.array(z.unknown()).optional(),
});

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
    description: 'Run EXPLAIN ANALYZE on a query to see the execution plan and actual timing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql: { type: 'string', description: 'SQL query to analyze' },
        params: { type: 'array', items: {}, description: 'Parameter values' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'pg_query_prepared',
    description: 'Manage named prepared statements: PREPARE (create), EXECUTE (run), DEALLOCATE (remove). Useful for server-side query plan caching.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', enum: ['prepare', 'execute', 'deallocate'], description: 'Action to perform' },
        name: { type: 'string', description: 'Prepared statement name' },
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
        const { sql, params } = ExplainSchema.parse(args);
        const result = await client.query(`EXPLAIN ANALYZE ${sql}`, params);
        const plan = result.rows.map((r) => Object.values(r)[0]).join('\n');
        return { content: [{ type: 'text', text: plan }] };
      }

      case 'pg_query_prepared': {
        const { action, name: stmtName, sql, params } = PreparedSchema.parse(args);
        switch (action) {
          case 'prepare': {
            if (!sql) return { content: [{ type: 'text', text: 'Error: sql is required for prepare action' }] };
            await client.query(`PREPARE ${stmtName} AS ${sql}`);
            return { content: [{ type: 'text', text: `Prepared statement '${stmtName}' created.` }] };
          }
          case 'execute': {
            const paramList = params && params.length > 0 ? `(${params.map((_, i) => `$${i + 1}`).join(', ')})` : '';
            const result = await client.query(`EXECUTE ${stmtName}${paramList}`, params);
            return { content: [{ type: 'text', text: JSON.stringify({ rows: result.rows, rowCount: result.rowCount }, null, 2) }] };
          }
          case 'deallocate': {
            await client.query(`DEALLOCATE ${stmtName}`);
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
