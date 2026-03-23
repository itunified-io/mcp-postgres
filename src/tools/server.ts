import { z } from 'zod';
import type { PostgresClient } from '../client/postgres-client.js';
import { CoercedBooleanSchema } from '../utils/validation.js';

const SettingsSchema = z.object({
  name: z.string().optional(),
});

const ReloadSchema = z.object({
  confirm: CoercedBooleanSchema.refine((v) => v === true, 'This operation reloads server configuration. Set confirm: true to proceed.'),
});

export const serverToolDefinitions = [
  {
    name: 'pg_version',
    description: 'Get PostgreSQL version string and numeric version.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_settings',
    description: 'Show or search server configuration parameters.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Filter settings by name (partial match)' },
      },
    },
  },
  {
    name: 'pg_reload_config',
    description: 'Reload server configuration files (postgresql.conf). Requires confirm: true.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to execute' },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'pg_uptime',
    description: 'Show server uptime and start time.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

export async function handleServerTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_version': {
        const version = await client.query('SELECT version()');
        const numVersion = await client.query('SHOW server_version_num');
        return { content: [{ type: 'text', text: JSON.stringify({
          version: version.rows[0]?.version,
          numeric: numVersion.rows[0]?.server_version_num,
        }, null, 2) }] };
      }

      case 'pg_settings': {
        const { name: settingName } = SettingsSchema.parse(args);
        const sql = settingName
          ? `SELECT name, setting, unit, category, short_desc FROM pg_settings WHERE name ILIKE $1 ORDER BY name`
          : `SELECT name, setting, unit, category, short_desc FROM pg_settings ORDER BY category, name`;
        const result = await client.query(sql, settingName ? [`%${settingName}%`] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_reload_config': {
        ReloadSchema.parse(args);
        await client.query('SELECT pg_reload_conf()');
        return { content: [{ type: 'text', text: 'Configuration reloaded successfully.' }] };
      }

      case 'pg_uptime': {
        const result = await client.query(
          `SELECT pg_postmaster_start_time() AS start_time, now() - pg_postmaster_start_time() AS uptime`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown server tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
