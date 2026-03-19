import { z } from 'zod';
import type { PostgresClient } from '../client/postgres-client.js';
import { IdentifierSchema } from '../utils/validation.js';

const SchemaFilterSchema = z.object({
  schema: IdentifierSchema.optional(),
});

const TableNameSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
});

export const schemaToolDefinitions = [
  {
    name: 'pg_schema_list',
    description: 'List all schemas in the database.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_table_list',
    description: 'List tables in the database. Optionally filter by schema name.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: { type: 'string', description: "Schema name filter (default: all user schemas)" },
      },
    },
  },
  {
    name: 'pg_table_describe',
    description: 'Describe a table: columns, data types, defaults, nullability, and constraints.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
      },
      required: ['table'],
    },
  },
  {
    name: 'pg_index_list',
    description: 'List indexes for a table with type, columns, uniqueness, and size.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
      },
      required: ['table'],
    },
  },
  {
    name: 'pg_constraint_list',
    description: 'List constraints (primary key, foreign key, unique, check) for a table.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
      },
      required: ['table'],
    },
  },
  {
    name: 'pg_view_list',
    description: 'List views with their definitions. Optionally filter by schema.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: { type: 'string', description: 'Schema name filter' },
      },
    },
  },
  {
    name: 'pg_function_list',
    description: 'List functions and procedures with their signatures.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: { type: 'string', description: 'Schema name filter' },
      },
    },
  },
  {
    name: 'pg_enum_list',
    description: 'List all enum types and their values.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_extension_list',
    description: 'List installed PostgreSQL extensions with versions.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

export async function handleSchemaTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_schema_list': {
        const result = await client.query(
          `SELECT schema_name, schema_owner FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_table_list': {
        const { schema } = SchemaFilterSchema.parse(args);
        const sql = schema
          ? `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`
          : `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY table_schema, table_name`;
        const result = await client.query(sql, schema ? [schema] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_table_describe': {
        const { table, schema } = TableNameSchema.parse(args);
        const schemaName = schema ?? 'public';
        const result = await client.query(
          `SELECT column_name, data_type, character_maximum_length, column_default, is_nullable, udt_name
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schemaName, table]
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_index_list': {
        const { table, schema } = TableNameSchema.parse(args);
        const schemaName = schema ?? 'public';
        const result = await client.query(
          `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2 ORDER BY indexname`,
          [schemaName, table]
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_constraint_list': {
        const { table, schema } = TableNameSchema.parse(args);
        const schemaName = schema ?? 'public';
        const result = await client.query(
          `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name,
                  ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
           FROM information_schema.table_constraints tc
           LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
           WHERE tc.table_schema = $1 AND tc.table_name = $2
           ORDER BY tc.constraint_type, tc.constraint_name`,
          [schemaName, table]
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_view_list': {
        const { schema } = SchemaFilterSchema.parse(args);
        const sql = schema
          ? `SELECT table_schema, table_name, view_definition FROM information_schema.views WHERE table_schema = $1 ORDER BY table_name`
          : `SELECT table_schema, table_name, view_definition FROM information_schema.views WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`;
        const result = await client.query(sql, schema ? [schema] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_function_list': {
        const { schema } = SchemaFilterSchema.parse(args);
        const sql = schema
          ? `SELECT n.nspname AS schema, p.proname AS name, pg_get_function_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS return_type
             FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = $1 ORDER BY p.proname`
          : `SELECT n.nspname AS schema, p.proname AS name, pg_get_function_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS return_type
             FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') ORDER BY n.nspname, p.proname`;
        const result = await client.query(sql, schema ? [schema] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_enum_list': {
        const result = await client.query(
          `SELECT t.typname AS enum_name, n.nspname AS schema, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
           FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON t.typnamespace = n.oid
           GROUP BY t.typname, n.nspname ORDER BY n.nspname, t.typname`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_extension_list': {
        const result = await client.query(
          `SELECT extname, extversion, n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid ORDER BY extname`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown schema tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
