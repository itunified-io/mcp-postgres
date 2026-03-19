import type { PostgresClient } from '../client/postgres-client.js';

export const connectionToolDefinitions = [
  {
    name: 'pg_connect',
    description: 'Connect to a PostgreSQL instance. Uses POSTGRES_CONNECTION_STRING env var or individual PG* env vars. Call this before using any other pg_* tools.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'pg_disconnect',
    description: 'Close the connection pool and disconnect from PostgreSQL.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'pg_connection_status',
    description: 'Check connection pool health: connected state, active/idle/waiting connections.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export async function handleConnectionTool(
  name: string,
  _args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_connect': {
        await client.connect();
        return { content: [{ type: 'text', text: 'Connected to PostgreSQL successfully.' }] };
      }

      case 'pg_disconnect': {
        await client.disconnect();
        return { content: [{ type: 'text', text: 'Disconnected from PostgreSQL.' }] };
      }

      case 'pg_connection_status': {
        const pool = await client.getPoolStatus();
        const status = {
          connected: client.isConnected(),
          pool,
        };
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown connection tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
