import { z } from 'zod';
import type { PostgresClient } from '../client/postgres-client.js';
import { IdentifierSchema, CoercedBooleanSchema } from '../utils/validation.js';

const InsertSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
  columns: z.array(z.string().min(1)).min(1, 'At least one column is required'),
  values: z.array(z.unknown()).min(1, 'At least one value is required'),
});

const UpdateSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
  set: z.record(z.unknown()).refine((obj) => Object.keys(obj).length > 0, 'At least one column to update is required'),
  where: z.string().min(1, 'WHERE clause is required for safety'),
  params: z.array(z.unknown()).optional(),
  confirm: CoercedBooleanSchema.refine((v) => v === true, 'This is a destructive operation. Set confirm: true to proceed.'),
});

const DeleteSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
  where: z.string().min(1, 'WHERE clause is required for safety'),
  params: z.array(z.unknown()).optional(),
  confirm: CoercedBooleanSchema.refine((v) => v === true, 'This is a destructive operation. Set confirm: true to proceed.'),
});

const UpsertSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
  columns: z.array(z.string().min(1)).min(1),
  values: z.array(z.unknown()).min(1),
  conflict_columns: z.array(z.string().min(1)).min(1, 'At least one conflict column is required'),
  confirm: CoercedBooleanSchema.refine((v) => v === true, 'This is a destructive operation. Set confirm: true to proceed.'),
});

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export const crudToolDefinitions = [
  {
    name: 'pg_insert',
    description: 'Insert one or more rows into a table. Returns inserted rows.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column names' },
        values: { type: 'array', items: {}, description: 'Values to insert (matches column order)' },
      },
      required: ['table', 'columns', 'values'],
    },
  },
  {
    name: 'pg_update',
    description: 'Update rows matching a WHERE clause. Requires confirm: true.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
        set: { type: 'object', description: 'Column-value pairs to update' },
        where: { type: 'string', description: 'WHERE clause (use $N for params)' },
        params: { type: 'array', items: {}, description: 'Parameter values for WHERE clause' },
        confirm: { type: 'boolean', description: 'Must be true to execute' },
      },
      required: ['table', 'set', 'where', 'confirm'],
    },
  },
  {
    name: 'pg_delete',
    description: 'Delete rows matching a WHERE clause. Requires confirm: true.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
        where: { type: 'string', description: 'WHERE clause (use $N for params)' },
        params: { type: 'array', items: {}, description: 'Parameter values for WHERE clause' },
        confirm: { type: 'boolean', description: 'Must be true to execute' },
      },
      required: ['table', 'where', 'confirm'],
    },
  },
  {
    name: 'pg_upsert',
    description: 'Insert or update on conflict. Requires confirm: true.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column names' },
        values: { type: 'array', items: {}, description: 'Values to insert' },
        conflict_columns: { type: 'array', items: { type: 'string' }, description: 'Columns for ON CONFLICT clause' },
        confirm: { type: 'boolean', description: 'Must be true to execute' },
      },
      required: ['table', 'columns', 'values', 'conflict_columns', 'confirm'],
    },
  },
];

export async function handleCrudTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_insert': {
        const { table, schema, columns, values } = InsertSchema.parse(args);
        const tableName = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
        const cols = columns.map(quoteIdent).join(', ');
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`;
        const result = await client.query(sql, values);
        return { content: [{ type: 'text', text: JSON.stringify({ inserted: result.rows, rowCount: result.rowCount }, null, 2) }] };
      }

      case 'pg_update': {
        const { table, schema, set, where, params } = UpdateSchema.parse(args);
        const tableName = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
        const entries = Object.entries(set);
        const setClauses = entries.map(([col], i) => `${quoteIdent(col)} = $${i + 1}`).join(', ');
        const setValues = entries.map(([, val]) => val);
        // Renumber WHERE params to come after SET params
        let adjustedWhere = where;
        const whereParams = params ?? [];
        for (let i = whereParams.length; i >= 1; i--) {
          adjustedWhere = adjustedWhere.replace(new RegExp(`\\$${i}\\b`, 'g'), `$${i + entries.length}`);
        }
        const sql = `UPDATE ${tableName} SET ${setClauses} WHERE ${adjustedWhere} RETURNING *`;
        const result = await client.query(sql, [...setValues, ...whereParams]);
        return { content: [{ type: 'text', text: JSON.stringify({ updated: result.rows, rowCount: result.rowCount }, null, 2) }] };
      }

      case 'pg_delete': {
        const { table, schema, where, params } = DeleteSchema.parse(args);
        const tableName = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
        const sql = `DELETE FROM ${tableName} WHERE ${where} RETURNING *`;
        const result = await client.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify({ deleted: result.rows, rowCount: result.rowCount }, null, 2) }] };
      }

      case 'pg_upsert': {
        const { table, schema, columns, values, conflict_columns } = UpsertSchema.parse(args);
        const tableName = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
        const cols = columns.map(quoteIdent).join(', ');
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const conflictCols = conflict_columns.map(quoteIdent).join(', ');
        const updateCols = columns
          .filter((c) => !conflict_columns.includes(c))
          .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
          .join(', ');
        const sql = updateCols
          ? `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateCols} RETURNING *`
          : `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) DO NOTHING RETURNING *`;
        const result = await client.query(sql, values);
        return { content: [{ type: 'text', text: JSON.stringify({ upserted: result.rows, rowCount: result.rowCount }, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown CRUD tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
