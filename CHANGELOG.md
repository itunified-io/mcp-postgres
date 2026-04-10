# Changelog

All notable changes to this project will be documented in this file.

## v2026.04.10.2

- **feat: add opportunistic Vault AppRole secret loading** (#7)
  - New `src/config/vault-loader.ts` — loads PG credentials from HashiCorp Vault KV v2
  - Wired into `index.ts` — runs before `PostgresClient.fromEnv()`
  - Maps: `connection_string` → `POSTGRES_CONNECTION_STRING`, `host/port/user/password/database` → `PG*` vars
  - Silent no-op when Vault is not configured — existing env var / config file flows unchanged
  - 15 unit tests covering skip, load, no-overwrite, error handling
  - README updated with comprehensive Vault integration guide

## v2026.04.10.1

- **chore: MCP Registry listing** (#6)
  - Add `server.json` manifest for registry.modelcontextprotocol.io
  - Add `mcpName` field to `package.json` for registry validation
  - Namespace: `io.github.itunified-io/postgres`
  - Version bump to 2026.4.10-1
- **fix: rename 'database' to 'profile' in connection tools** (#5)
  - Connection tools now use `profile` instead of `database` for named profiles

## v2026.03.23.1

- feat: 27 PostgreSQL MCP tools — connection, query, schema, CRUD, server, database
- fix: pg_query_explain mode=analyze always requires confirm:true
- fix: pg_query_prepared validates statement names via IdentifierSchema + quoteIdent
- fix: pg_query_prepared marked as DEPRECATED
- test: unit tests for all 27 tool schemas and confirm gates
- docs: Security section accurately describes safety model
- docs: CLAUDE.md with safety and test conventions
