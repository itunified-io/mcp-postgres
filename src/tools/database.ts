import type { PostgresClient } from '../client/postgres-client.js';

export const databaseToolDefinitions = [
  {
    name: 'pg_database_size',
    description: 'Show size of all databases.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_table_sizes',
    description: 'Show table sizes with index and toast breakdown, sorted by total size descending.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: { type: 'string', description: "Schema name filter (default: 'public')" },
      },
    },
  },
];

export async function handleDatabaseTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_database_size': {
        const result = await client.query(
          `SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size, pg_database_size(datname) AS size_bytes
           FROM pg_database WHERE datistemplate = false ORDER BY pg_database_size(datname) DESC`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_table_sizes': {
        const schema = typeof args.schema === 'string' ? args.schema : 'public';
        const result = await client.query(
          `SELECT schemaname, tablename,
                  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
                  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
                  pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) AS index_size,
                  pg_total_relation_size(schemaname || '.' || tablename) AS total_bytes
           FROM pg_tables WHERE schemaname = $1
           ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC`,
          [schema]
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown database tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
