import { z } from 'zod';
import type { PostgresClient } from '../client/postgres-client.js';
import { IdentifierSchema, CoercedBooleanSchema } from '../utils/validation.js';

const VacuumSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
  full: CoercedBooleanSchema.optional(),
  analyze: CoercedBooleanSchema.optional(),
  confirm: CoercedBooleanSchema.optional(),
});

const AnalyzeSchema = z.object({
  table: z.string().optional(),
  schema: IdentifierSchema.optional(),
});

const ReindexSchema = z.object({
  target: z.string().min(1, 'Target name is required'),
  type: z.enum(['TABLE', 'INDEX']).default('TABLE'),
  schema: IdentifierSchema.optional(),
  confirm: CoercedBooleanSchema.refine((v) => v === true, 'This is a destructive operation. Set confirm: true to proceed.'),
});

const StatFilterSchema = z.object({
  schema: IdentifierSchema.optional(),
  state: z.string().optional(),
});

const TableStatSchema = z.object({
  schema: IdentifierSchema.optional(),
});

const IndexStatSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: IdentifierSchema.optional(),
});

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export const dbaToolDefinitions = [
  {
    name: 'pg_vacuum',
    description: 'Run VACUUM on a table. Use full: true for VACUUM FULL (requires confirm: true). Use analyze: true to include ANALYZE.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
        full: { type: 'boolean', description: 'Run VACUUM FULL (rewrites table, requires confirm)' },
        analyze: { type: 'boolean', description: 'Include ANALYZE' },
        confirm: { type: 'boolean', description: 'Required for VACUUM FULL' },
      },
      required: ['table'],
    },
  },
  {
    name: 'pg_analyze',
    description: 'Run ANALYZE to update table statistics. Omit table to analyze entire database.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table name (omit for whole database)' },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
      },
    },
  },
  {
    name: 'pg_reindex',
    description: 'Reindex a table or specific index. Requires confirm: true.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', description: 'Table or index name' },
        type: { type: 'string', enum: ['TABLE', 'INDEX'], description: "Target type (default: 'TABLE')" },
        schema: { type: 'string', description: "Schema name (default: 'public')" },
        confirm: { type: 'boolean', description: 'Must be true to execute' },
      },
      required: ['target', 'confirm'],
    },
  },
  {
    name: 'pg_stat_activity',
    description: 'Show active queries, connections, and wait events from pg_stat_activity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        state: { type: 'string', description: "Filter by state (e.g., 'active', 'idle')" },
      },
    },
  },
  {
    name: 'pg_stat_tables',
    description: 'Table-level statistics: sequential/index scans, inserts, updates, deletes, dead tuples.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: { type: 'string', description: "Schema name filter (default: all user schemas)" },
      },
    },
  },
  {
    name: 'pg_stat_indexes',
    description: 'Index usage statistics: scans, tuples read/fetched.',
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
    name: 'pg_locks',
    description: 'Show current locks with blocking/waiting information.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_cache_hit_ratio',
    description: 'Calculate buffer cache hit ratio for heap and index reads.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_bloat_check',
    description: 'Estimate table bloat from dead tuple ratios.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: { type: 'string', description: 'Schema name filter' },
      },
    },
  },
];

export async function handleDbaTool(
  name: string,
  args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_vacuum': {
        const { table, schema, full, analyze, confirm } = VacuumSchema.parse(args);
        if (full && !confirm) {
          return { content: [{ type: 'text', text: 'VACUUM FULL is a destructive operation that rewrites the entire table. Set confirm: true to proceed.' }] };
        }
        const tableName = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
        const opts = [full ? 'FULL' : '', analyze ? 'ANALYZE' : ''].filter(Boolean).join(' ');
        await client.query(`VACUUM ${opts} ${tableName}`);
        return { content: [{ type: 'text', text: `VACUUM ${opts} ${tableName} completed.` }] };
      }

      case 'pg_analyze': {
        const { table, schema } = AnalyzeSchema.parse(args);
        if (table) {
          const tableName = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
          await client.query(`ANALYZE ${tableName}`);
          return { content: [{ type: 'text', text: `ANALYZE ${tableName} completed.` }] };
        }
        await client.query('ANALYZE');
        return { content: [{ type: 'text', text: 'ANALYZE completed for entire database.' }] };
      }

      case 'pg_reindex': {
        const { target, type, schema } = ReindexSchema.parse(args);
        const targetName = schema ? `${quoteIdent(schema)}.${quoteIdent(target)}` : quoteIdent(target);
        await client.query(`REINDEX ${type} ${targetName}`);
        return { content: [{ type: 'text', text: `REINDEX ${type} ${targetName} completed.` }] };
      }

      case 'pg_stat_activity': {
        const { state } = StatFilterSchema.parse(args);
        const sql = state
          ? `SELECT pid, usename, datname, state, query, query_start, wait_event_type, wait_event, backend_type FROM pg_stat_activity WHERE state = $1 ORDER BY query_start`
          : `SELECT pid, usename, datname, state, query, query_start, wait_event_type, wait_event, backend_type FROM pg_stat_activity WHERE pid <> pg_backend_pid() ORDER BY query_start`;
        const result = await client.query(sql, state ? [state] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_stat_tables': {
        const { schema } = TableStatSchema.parse(args);
        const sql = schema
          ? `SELECT schemaname, relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze FROM pg_stat_user_tables WHERE schemaname = $1 ORDER BY n_dead_tup DESC`
          : `SELECT schemaname, relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze FROM pg_stat_user_tables ORDER BY n_dead_tup DESC`;
        const result = await client.query(sql, schema ? [schema] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_stat_indexes': {
        const { table, schema } = IndexStatSchema.parse(args);
        const schemaName = schema ?? 'public';
        const result = await client.query(
          `SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch, pg_size_pretty(pg_relation_size(indexrelid)) AS size FROM pg_stat_user_indexes WHERE schemaname = $1 AND relname = $2 ORDER BY idx_scan DESC`,
          [schemaName, table]
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_locks': {
        const result = await client.query(
          `SELECT l.pid, l.locktype, l.mode, l.granted, l.waitstart, a.usename, a.datname, a.query, a.state
           FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid
           WHERE a.pid <> pg_backend_pid()
           ORDER BY l.granted, l.waitstart`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_cache_hit_ratio': {
        const result = await client.query(
          `SELECT datname,
                  round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 2) AS cache_hit_ratio,
                  sum(blks_hit) AS blocks_hit,
                  sum(blks_read) AS blocks_read
           FROM pg_stat_database
           WHERE datname = current_database()
           GROUP BY datname`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_bloat_check': {
        const { schema } = TableStatSchema.parse(args);
        const sql = schema
          ? `SELECT schemaname, relname, n_live_tup, n_dead_tup,
                    CASE WHEN n_live_tup > 0 THEN round(100.0 * n_dead_tup / n_live_tup, 2) ELSE 0 END AS dead_ratio_pct,
                    last_autovacuum
             FROM pg_stat_user_tables WHERE schemaname = $1 AND n_dead_tup > 0 ORDER BY n_dead_tup DESC`
          : `SELECT schemaname, relname, n_live_tup, n_dead_tup,
                    CASE WHEN n_live_tup > 0 THEN round(100.0 * n_dead_tup / n_live_tup, 2) ELSE 0 END AS dead_ratio_pct,
                    last_autovacuum
             FROM pg_stat_user_tables WHERE n_dead_tup > 0 ORDER BY n_dead_tup DESC`;
        const result = await client.query(sql, schema ? [schema] : undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown DBA tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
