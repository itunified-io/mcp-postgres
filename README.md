# mcp-postgres

[![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@itunified.io/mcp-postgres)](https://www.npmjs.com/package/@itunified.io/mcp-postgres)

A comprehensive PostgreSQL MCP (Model Context Protocol) server providing 40+ tools for database management, monitoring, and administration.

## Features

- **Connection Management** — connect, disconnect, pool health monitoring
- **Query Execution** — parameterized queries, EXPLAIN ANALYZE, prepared statements
- **Schema Introspection** — tables, indexes, constraints, views, functions, enums, extensions
- **CRUD Operations** — type-safe insert, update, delete, upsert with injection protection
- **DBA Monitoring** — pg_stat_activity, table/index stats, locks, cache hit ratio, bloat detection
- **Server Management** — version, settings, config reload, uptime
- **HA Monitoring** — replication status, slots, WAL status, standby detection (read-only)
- **Database Sizing** — database and table sizes with index/toast breakdown

## Installation

```bash
npm install @itunified.io/mcp-postgres
```

Or run directly:

```bash
npx @itunified.io/mcp-postgres
```

## Configuration

Set one of the following environment variables:

```bash
# Option 1: Connection string (preferred)
export POSTGRES_CONNECTION_STRING="postgresql://myuser:mypassword@your-database.example.com:5432/mydb"

# Option 2: Individual variables
export PGHOST="your-database.example.com"
export PGPORT="5432"
export PGUSER="myuser"
export PGPASSWORD="mypassword"
export PGDATABASE="mydb"
export PGSSLMODE="require"  # optional
```

### Multi-Database Configuration

Create a config file at `~/.config/mcp-postgres/databases.yaml`:

```yaml
databases:
  production:
    host: db.example.com
    port: 5432
    user: admin
    password: ${DB_PROD_PASSWORD}
    database: myapp
    ssl: true
  staging:
    host: staging-db.example.com
    port: 5432
    user: admin
    password: ${DB_STAGING_PASSWORD}
    database: myapp
default: production
```

Environment variables in `${VAR_NAME}` syntax are automatically expanded.

Config file discovery order:
1. `POSTGRES_CONFIG_FILE` env var (explicit path)
2. `~/.config/mcp-postgres/databases.yaml` or `databases.json`
3. `POSTGRES_CONNECTION_STRING` env var (single database)
4. Individual `PG*` env vars (single database)

Override the config path with `POSTGRES_CONFIG_FILE` env var:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@itunified.io/mcp-postgres"],
      "env": {
        "POSTGRES_CONFIG_FILE": "/path/to/databases.yaml"
      }
    }
  }
}
```

Use `pg_list_connections` to see all configured databases, `pg_switch_database` to change the active one.

### Claude Desktop / MCP Settings

Add to your `settings.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@itunified.io/mcp-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://myuser:mypassword@your-database.example.com:5432/mydb"
      }
    }
  }
}
```

## Tools

### Connection (5 tools)

| Tool | Description |
|------|-------------|
| `pg_connect` | Connect to a database (default or named) |
| `pg_disconnect` | Disconnect from a database or all |
| `pg_connection_status` | Pool health for active or named database |
| `pg_list_connections` | List all configured databases and status |
| `pg_switch_database` | Switch the active database context |

### Query (3 tools)

| Tool | Description |
|------|-------------|
| `pg_query` | Execute parameterized SELECT/DML query |
| `pg_query_explain` | Run EXPLAIN ANALYZE on a query |
| `pg_query_prepared` | Manage named prepared statements (PREPARE/EXECUTE/DEALLOCATE) |

### Schema Introspection (9 tools)

| Tool | Description |
|------|-------------|
| `pg_schema_list` | List all schemas |
| `pg_table_list` | List tables (with optional schema filter) |
| `pg_table_describe` | Describe table columns, types, defaults, constraints |
| `pg_index_list` | List indexes for a table |
| `pg_constraint_list` | List constraints (PK, FK, unique, check) |
| `pg_view_list` | List views with definitions |
| `pg_function_list` | List functions/procedures with signatures |
| `pg_enum_list` | List enum types and values |
| `pg_extension_list` | List installed extensions |

### CRUD (4 tools)

| Tool | Description |
|------|-------------|
| `pg_insert` | Insert row(s) with parameterized values |
| `pg_update` | Update rows (requires `confirm: true`) |
| `pg_delete` | Delete rows (requires `confirm: true`) |
| `pg_upsert` | Insert or update on conflict (requires `confirm: true`) |

### DBA / Monitoring (9 tools)

| Tool | Description |
|------|-------------|
| `pg_vacuum` | Run VACUUM on table |
| `pg_analyze` | Run ANALYZE on table or database |
| `pg_reindex` | Reindex table or index (requires `confirm: true`) |
| `pg_stat_activity` | Show active queries, connections, wait events |
| `pg_stat_tables` | Table-level stats: scans, inserts, dead tuples |
| `pg_stat_indexes` | Index usage stats |
| `pg_locks` | Current locks with blocking info |
| `pg_cache_hit_ratio` | Buffer cache hit ratio |
| `pg_bloat_check` | Estimate table/index bloat |

### Server (4 tools)

| Tool | Description |
|------|-------------|
| `pg_version` | PostgreSQL version |
| `pg_settings` | Show/search server configuration |
| `pg_reload_config` | Reload configuration (requires `confirm: true`) |
| `pg_uptime` | Server uptime and start time |

### HA Monitoring (4 tools)

| Tool | Description |
|------|-------------|
| `pg_replication_status` | Streaming replication state and lag |
| `pg_replication_slots` | List replication slots |
| `pg_wal_status` | WAL generation rate and archive status |
| `pg_standby_status` | Primary vs standby detection |

### Database Management (2 tools)

| Tool | Description |
|------|-------------|
| `pg_database_size` | Size of all databases |
| `pg_table_sizes` | Table sizes with index/toast breakdown |

## Enterprise Edition

For advanced PostgreSQL operations, **mcp-postgres-enterprise** extends this server with:

- **CloudNativePG (CNPG)** — K8s cluster management, failover, switchover, backup orchestration
- **HA Operations** — Replication slot management, PgBouncer pool control
- **Backup / PITR** — pg_dump/pg_restore orchestration, point-in-time recovery
- **RBAC** — Role management, privilege grants, row-level security policies
- **Audit** — Query log analysis, connection audit, permission mapping
- **Compliance** — SSL enforcement, connection limit checks

Available as a private GitHub package. Contact [itunified.io](https://github.com/sponsors/itunified-io) for access.

## Security

### Query Safety Model

- **CRUD tools** (`pg_insert`, `pg_update`, `pg_delete`, `pg_upsert`): All use parameterized queries (`$1`, `$2`, ...) — safe from SQL injection. Destructive operations require `confirm: true`.
- **`pg_query`**: Unrestricted raw SQL runner by design — intended for power users who need full SQL flexibility. No injection protection is applied because the tool's purpose is to execute arbitrary SQL.
- **`pg_query_explain`**: Defaults to safe `plan` mode (EXPLAIN only, no execution). `mode=analyze` always requires `confirm: true` because EXPLAIN ANALYZE executes the statement.
- **`pg_query_prepared`**: **Deprecated.** Prepared statements are session-local in PostgreSQL and unreliable with connection pools. Statement names are validated as SQL identifiers. Use parameterized `pg_query` instead.

### Destructive Operations

These tools require `confirm: true` to execute:
- `pg_update`, `pg_delete`, `pg_upsert` — data modification
- `pg_vacuum` (FULL mode), `pg_reindex` — maintenance
- `pg_reload_config` — server configuration
- `pg_query_explain` (analyze mode) — statement execution

### Credentials

- Connection credentials are read from environment variables or JSON/YAML config — never logged or stored
- All identifiers (table, column, schema names) are validated against a strict regex pattern

## License

This project is dual-licensed:

1. **[AGPL-3.0](LICENSE)** — Free for open-source and non-commercial use
2. **[Commercial License](COMMERCIAL_LICENSE.md)** — For proprietary and commercial use

See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for details.

## Contributing

Contributions are welcome! Please open an issue first to discuss proposed changes.
