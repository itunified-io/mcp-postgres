# Changelog

All notable changes to this project will be documented in this file.

## v2026.03.23.1

- fix: pg_query_explain mode=analyze always requires confirm:true (#1)
- fix: pg_query_prepared validates statement names via IdentifierSchema + quoteIdent (#1)
- fix: pg_query_prepared marked as DEPRECATED (#1)
- fix: removed passWithNoTests:true from vitest config (#1)
- test: added unit tests for all 40 tool schemas and confirm gates — 63 tests (#1)
- docs: rewrote README Security section to accurately describe safety model (#1)
- docs: added CLAUDE.md with safety and test conventions (#1)

## v2026.03.19.1

- Initial release
- Project scaffold with AGPL-3.0 dual license
- 38 PostgreSQL MCP tools: connection, query, schema, CRUD, DBA, server, HA monitoring, database sizing
