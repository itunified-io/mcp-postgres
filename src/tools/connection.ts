import type { PostgresClient } from '../client/postgres-client.js';

/**
 * Resolve profile name from args — accepts both `profile` (preferred) and
 * `database` (deprecated, backward-compatible) parameters.
 */
function resolveProfile(args: Record<string, unknown>): string | undefined {
  if (typeof args.profile === 'string') return args.profile;
  if (typeof args.database === 'string') return args.database;
  return undefined;
}

export const connectionToolDefinitions = [
  {
    name: 'pg_connect',
    description:
      'Connect to a PostgreSQL server profile. If multiple profiles are configured, specify which one. Otherwise connects to the default profile.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        profile: {
          type: 'string',
          description:
            'Named connection profile from config file (optional, uses default if omitted). Each profile points to a PostgreSQL server instance.',
        },
        database: {
          type: 'string',
          description: 'Deprecated — use "profile" instead. Kept for backward compatibility.',
        },
      },
    },
  },
  {
    name: 'pg_disconnect',
    description: 'Disconnect from a PostgreSQL server profile. Omit profile to disconnect all.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        profile: {
          type: 'string',
          description: 'Named profile to disconnect (omit to disconnect all)',
        },
        database: {
          type: 'string',
          description: 'Deprecated — use "profile" instead.',
        },
      },
    },
  },
  {
    name: 'pg_connection_status',
    description:
      'Check connection pool health for the active profile or a specific named profile.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        profile: {
          type: 'string',
          description: 'Named profile (omit for active profile)',
        },
        database: {
          type: 'string',
          description: 'Deprecated — use "profile" instead.',
        },
      },
    },
  },
  {
    name: 'pg_list_connections',
    description:
      'List all configured connection profiles and their status. Each profile represents a PostgreSQL server instance (not a database within a server).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'pg_switch_profile',
    description:
      'Switch the active connection profile. All subsequent queries will use this profile unless overridden. Each profile targets a specific PostgreSQL server instance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        profile: {
          type: 'string',
          description: 'Named profile to switch to',
        },
        database: {
          type: 'string',
          description: 'Deprecated — use "profile" instead.',
        },
      },
      required: ['profile'],
    },
  },
  // Backward-compatible alias — keep for one release cycle
  {
    name: 'pg_switch_database',
    description:
      'Deprecated — use pg_switch_profile instead. Switch the active connection profile.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        database: {
          type: 'string',
          description: 'Named profile to switch to (deprecated param name)',
        },
        profile: {
          type: 'string',
          description: 'Named profile to switch to',
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
    const profile = resolveProfile(args);

    switch (name) {
      case 'pg_connect': {
        await client.connect(profile);
        const profileName = profile ?? client.getActiveDatabase();
        return {
          content: [
            {
              type: 'text',
              text: `Connected to profile '${profileName}' successfully.`,
            },
          ],
        };
      }

      case 'pg_disconnect': {
        await client.disconnect(profile);
        const msg = profile
          ? `Disconnected from profile '${profile}'.`
          : 'Disconnected from all profiles.';
        return { content: [{ type: 'text', text: msg }] };
      }

      case 'pg_connection_status': {
        const status = await client.getPoolStatus(profile);
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      case 'pg_list_connections': {
        const profiles = client.getConfiguredDatabases();
        const active = client.getActiveDatabase();
        const statuses = await Promise.all(
          profiles.map(async (p) => {
            const status = await client.getPoolStatus(p);
            return { profile: p, ...status, active: p === active };
          }),
        );
        return { content: [{ type: 'text', text: JSON.stringify(statuses, null, 2) }] };
      }

      case 'pg_switch_profile':
      case 'pg_switch_database': {
        if (!profile) {
          return {
            content: [{ type: 'text', text: 'Error: profile parameter is required.' }],
          };
        }
        client.setActiveDatabase(profile);
        return {
          content: [
            {
              type: 'text',
              text: `Switched active profile to '${profile}'.`,
            },
          ],
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
