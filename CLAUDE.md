# mcp-postgres

## Safety Conventions

- **Confirm gates:** All destructive operations MUST require `confirm: true` via `ConfirmSchema`
- **Identifier validation:** All user-provided SQL identifiers MUST go through `IdentifierSchema` (regex `^[a-zA-Z_][a-zA-Z0-9_]*$`, max 63 chars)
- **Quote identifiers:** Always wrap validated identifiers with `quoteIdent()` as defense-in-depth
- **SQL interpolation:** NEVER interpolate user input directly into SQL. Use parameterized queries (`$1`, `$2`) for values. Use `IdentifierSchema` + `quoteIdent()` for identifiers.
- **pg_query_explain:** `mode=analyze` ALWAYS requires `confirm: true` regardless of SQL content

## Test Conventions

- Unit tests: `tests/` directory, vitest, no PG connection needed — validate schemas and safety gates
- Live tests: `/pg-test` skill in infrastructure repo — runs against real PG 14-18 on ai-buecheleb
- `passWithNoTests` is disabled — CI fails if tests disappear

## Git Workflow

- CalVer: `YYYY.MM.DD.TS` (npm uses hyphens: `YYYY.M.DD-TS`)
- Every change needs a GitHub issue
- CHANGELOG.md updated on every PR merge
- npm publish via `/npm-publish` skill
