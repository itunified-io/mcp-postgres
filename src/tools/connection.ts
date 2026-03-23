import type { PostgresClient } from '../client/postgres-client.js';

export const connectionToolDefinitions = [
  {
    name: 'pg_connect',
    description:
      'Connect to a PostgreSQL database. If multiple databases are configured, specify which one. Otherwise connects to the default.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        database: {
          type: 'string',
          description: 'Named database from config file (optional, uses default if omitted)',
        },
      },
    },
  },
  {
    name: 'pg_disconnect',
    description: 'Disconnect from a PostgreSQL database. Omit database to disconnect all.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        database: {
          type: 'string',
          description: 'Named database to disconnect (omit to disconnect all)',
        },
      },
    },
  },
  {
    name: 'pg_connection_status',
    description:
      'Check connection pool health for the active database or a specific named database.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        database: {
          type: 'string',
          description: 'Named database (omit for active database)',
        },
      },
    },
  },
  {
    name: 'pg_list_connections',
    description: 'List all configured databases and their connection status.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'pg_switch_database',
    description:
      'Switch the active database context. All subsequent queries will use this database unless overridden.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        database: {
          type: 'string',
          description: 'Named database to switch to',
        },
      },
      required: ['database'],
    },
  },
];

export async function handleConnectionTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const database = typeof args.database === 'string' ? args.database : undefined;

    switch (name) {
      case 'pg_connect': {
        await client.connect(database);
        const dbName = database ?? client.getActiveDatabase();
        return {
          content: [{ type: 'text', text: `Connected to '${dbName}' successfully.` }],
        };
      }

      case 'pg_disconnect': {
        await client.disconnect(database);
        const msg = database
          ? `Disconnected from '${database}'.`
          : 'Disconnected from all databases.';
        return { content: [{ type: 'text', text: msg }] };
      }

      case 'pg_connection_status': {
        const status = await client.getPoolStatus(database);
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      case 'pg_list_connections': {
        const databases = client.getConfiguredDatabases();
        const active = client.getActiveDatabase();
        const statuses = await Promise.all(
          databases.map(async (db) => {
            const status = await client.getPoolStatus(db);
            return { ...status, active: db === active };
          }),
        );
        return { content: [{ type: 'text', text: JSON.stringify(statuses, null, 2) }] };
      }

      case 'pg_switch_database': {
        if (!database) {
          return {
            content: [{ type: 'text', text: 'Error: database parameter is required.' }],
          };
        }
        client.setActiveDatabase(database);
        return {
          content: [{ type: 'text', text: `Switched active database to '${database}'.` }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown connection tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
