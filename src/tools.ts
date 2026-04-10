import { z } from "zod";
import type { ToolDefinition } from "./plugin.js";

// ─── PostgreSQL Database Operations (27 tools) ─────────────────────
// Maps 1:1 to dbxcli pg <group> <action> --format json

const target = z.string().describe("Target name from ~/.dbx/targets/");

export const tools: ToolDefinition[] = [
  // ── Connection (5 tools) ────────────────────────────────────────────
  {
    name: "pg_connect",
    description:
      "Connect to a PostgreSQL server target. If multiple targets are configured, specify which one. Otherwise connects to the default target.",
    inputSchema: {
      target,
      profile: z.string().optional().describe("Named connection profile (optional, uses default if omitted)"),
    },
    domain: "pg",
    action: "connect add",
  },
  {
    name: "pg_disconnect",
    description: "Disconnect from a PostgreSQL server target. Omit profile to disconnect all.",
    inputSchema: {
      target,
      profile: z.string().optional().describe("Named profile to disconnect (omit to disconnect all)"),
    },
    domain: "pg",
    action: "connect remove",
  },
  {
    name: "pg_connection_status",
    description:
      "Check connection pool health for the active profile or a specific named profile.",
    inputSchema: {
      target,
      profile: z.string().optional().describe("Named profile (omit for active profile)"),
    },
    domain: "pg",
    action: "connect status",
  },
  {
    name: "pg_list_connections",
    description:
      "List all configured connection profiles and their status. Each profile represents a PostgreSQL server instance.",
    inputSchema: {
      target,
    },
    domain: "pg",
    action: "connect list",
  },
  {
    name: "pg_switch_database",
    description:
      "Switch the active connection profile. All subsequent queries will use this profile unless overridden.",
    inputSchema: {
      target,
      profile: z.string().describe("Named profile to switch to"),
    },
    domain: "pg",
    action: "connect switch",
  },

  // ── Query (3 tools) ─────────────────────────────────────────────────
  {
    name: "pg_query",
    description:
      "Execute a parameterized SQL query. Returns rows as JSON. Use $1, $2, ... for parameters.",
    inputSchema: {
      target,
      sql: z.string().describe("SQL query with $1, $2, ... placeholders"),
      params: z.string().optional().describe("JSON array of parameter values for placeholders"),
    },
    domain: "pg",
    action: "query exec",
  },
  {
    name: "pg_query_explain",
    description:
      "Run EXPLAIN on a query. mode=plan (default, safe) shows the plan without executing. mode=analyze executes the statement and shows actual timing — requires confirm=true.",
    inputSchema: {
      target,
      sql: z.string().describe("SQL query to explain"),
      params: z.string().optional().describe("JSON array of parameter values"),
      mode: z.enum(["plan", "analyze"]).default("plan").optional().describe("Explain mode: plan (safe) or analyze (executes, requires confirm)"),
      confirm: z.string().optional().describe("Set to 'true' for mode=analyze (EXPLAIN ANALYZE executes the statement)"),
    },
    domain: "pg",
    action: "query explain",
  },
  {
    name: "pg_query_prepared",
    description:
      "[DEPRECATED] Manage named prepared statements: PREPARE, EXECUTE, DEALLOCATE. Prepared statements are session-local and unreliable with connection pools. Use parameterized pg_query instead.",
    inputSchema: {
      target,
      action_type: z.enum(["prepare", "execute", "deallocate"]).describe("Action to perform"),
      name: z.string().describe("Prepared statement name"),
      sql: z.string().optional().describe("SQL query (required for prepare)"),
      params: z.string().optional().describe("JSON array of parameters (for execute)"),
    },
    domain: "pg",
    action: "query prepared",
  },

  // ── Schema (9 tools) ────────────────────────────────────────────────
  {
    name: "pg_schema_list",
    description: "List all schemas in the database.",
    inputSchema: { target },
    domain: "pg",
    action: "schema schemas",
  },
  {
    name: "pg_table_list",
    description: "List tables in the database. Optionally filter by schema name.",
    inputSchema: {
      target,
      schema: z.string().optional().describe("Schema name filter (default: all user schemas)"),
    },
    domain: "pg",
    action: "schema tables",
  },
  {
    name: "pg_table_describe",
    description:
      "Describe a table: columns, data types, defaults, nullability, and constraints.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
    },
    domain: "pg",
    action: "schema table-describe",
  },
  {
    name: "pg_index_list",
    description: "List indexes for a table with type, columns, uniqueness, and size.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
    },
    domain: "pg",
    action: "schema indexes",
  },
  {
    name: "pg_constraint_list",
    description:
      "List constraints (primary key, foreign key, unique, check) for a table.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
    },
    domain: "pg",
    action: "schema constraints",
  },
  {
    name: "pg_view_list",
    description: "List views with their definitions. Optionally filter by schema.",
    inputSchema: {
      target,
      schema: z.string().optional().describe("Schema name filter"),
    },
    domain: "pg",
    action: "schema views",
  },
  {
    name: "pg_function_list",
    description: "List functions and procedures with their signatures.",
    inputSchema: {
      target,
      schema: z.string().optional().describe("Schema name filter"),
    },
    domain: "pg",
    action: "schema functions",
  },
  {
    name: "pg_enum_list",
    description: "List all enum types and their values.",
    inputSchema: { target },
    domain: "pg",
    action: "schema types",
  },
  {
    name: "pg_extension_list",
    description: "List installed PostgreSQL extensions with versions.",
    inputSchema: { target },
    domain: "pg",
    action: "schema extensions",
  },

  // ── CRUD (4 tools) ──────────────────────────────────────────────────
  {
    name: "pg_insert",
    description: "Insert one or more rows into a table. Returns inserted rows.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
      columns: z.string().describe("JSON array of column names"),
      values: z.string().describe("JSON array of values to insert (matches column order)"),
    },
    domain: "pg",
    action: "crud insert",
  },
  {
    name: "pg_update",
    description: "Update rows matching a WHERE clause. Requires confirm=true.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
      set: z.string().describe("JSON object of column-value pairs to update"),
      where: z.string().describe("WHERE clause (use $N for params)"),
      params: z.string().optional().describe("JSON array of parameter values for WHERE clause"),
      confirm: z.string().describe("Must be 'true' to execute this destructive operation"),
    },
    domain: "pg",
    action: "crud update",
  },
  {
    name: "pg_delete",
    description: "Delete rows matching a WHERE clause. Requires confirm=true.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
      where: z.string().describe("WHERE clause (use $N for params)"),
      params: z.string().optional().describe("JSON array of parameter values for WHERE clause"),
      confirm: z.string().describe("Must be 'true' to execute this destructive operation"),
    },
    domain: "pg",
    action: "crud delete",
  },
  {
    name: "pg_upsert",
    description: "Insert or update on conflict. Requires confirm=true.",
    inputSchema: {
      target,
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: 'public')"),
      columns: z.string().describe("JSON array of column names"),
      values: z.string().describe("JSON array of values to insert"),
      conflict_columns: z.string().describe("JSON array of columns for ON CONFLICT clause"),
      confirm: z.string().describe("Must be 'true' to execute this destructive operation"),
    },
    domain: "pg",
    action: "crud upsert",
  },

  // ── Server/DBA (6 tools) ────────────────────────────────────────────
  {
    name: "pg_version",
    description: "Get PostgreSQL version string and numeric version.",
    inputSchema: { target },
    domain: "pg",
    action: "dba version",
  },
  {
    name: "pg_settings",
    description: "Show or search server configuration parameters.",
    inputSchema: {
      target,
      name: z.string().optional().describe("Filter settings by name (partial match)"),
    },
    domain: "pg",
    action: "dba settings",
  },
  {
    name: "pg_reload_config",
    description:
      "Reload server configuration files (postgresql.conf). Requires confirm=true.",
    inputSchema: {
      target,
      confirm: z.string().describe("Must be 'true' to reload configuration"),
    },
    domain: "pg",
    action: "dba reload",
  },
  {
    name: "pg_uptime",
    description: "Show server uptime and start time.",
    inputSchema: { target },
    domain: "pg",
    action: "dba uptime",
  },
  {
    name: "pg_database_size",
    description: "Show size of all databases.",
    inputSchema: { target },
    domain: "pg",
    action: "dba database-sizes",
  },
  {
    name: "pg_table_sizes",
    description:
      "Show table sizes with index and toast breakdown, sorted by total size descending.",
    inputSchema: {
      target,
      schema: z.string().optional().describe("Schema name filter (default: 'public')"),
    },
    domain: "pg",
    action: "dba table-sizes",
  },
];
