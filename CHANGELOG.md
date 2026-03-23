# Changelog

All notable changes to this project will be documented in this file.

## v2026.03.23.1

- feat: 27 PostgreSQL MCP tools — connection, query, schema, CRUD, server, database
- fix: pg_query_explain mode=analyze always requires confirm:true
- fix: pg_query_prepared validates statement names via IdentifierSchema + quoteIdent
- fix: pg_query_prepared marked as DEPRECATED
- test: unit tests for all 27 tool schemas and confirm gates
- docs: Security section accurately describes safety model
- docs: CLAUDE.md with safety and test conventions
