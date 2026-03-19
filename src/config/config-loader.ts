import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface DatabaseConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
  ssl?: boolean;
}

export interface MultiDbConfig {
  databases: Record<string, DatabaseConfig>;
  default: string;
}

function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? '');
}

function expandConfigValues(config: DatabaseConfig): DatabaseConfig {
  const expanded: DatabaseConfig = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      (expanded as Record<string, unknown>)[key] = expandEnvVars(value);
    } else {
      (expanded as Record<string, unknown>)[key] = value;
    }
  }
  return expanded;
}

export function loadConfig(): MultiDbConfig {
  // 1. Check POSTGRES_CONFIG_FILE env var
  const configFile = process.env.POSTGRES_CONFIG_FILE;
  if (configFile && existsSync(configFile)) {
    return parseConfigFile(configFile);
  }

  // 2. Check default config path
  const defaultPath = join(homedir(), '.config', 'mcp-postgres', 'databases.yaml');
  if (existsSync(defaultPath)) {
    return parseConfigFile(defaultPath);
  }

  // Also check .json variant
  const defaultJsonPath = join(homedir(), '.config', 'mcp-postgres', 'databases.json');
  if (existsSync(defaultJsonPath)) {
    return parseConfigFile(defaultJsonPath);
  }

  // 3. Fallback to single connection from env vars
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (connectionString) {
    return {
      databases: { default: { connectionString } },
      default: 'default',
    };
  }

  // 4. Fallback to individual PG* env vars
  return {
    databases: {
      default: {
        host: process.env.PGHOST ?? 'localhost',
        port: parseInt(process.env.PGPORT ?? '5432', 10),
        user: process.env.PGUSER ?? 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE ?? 'postgres',
        ssl: process.env.PGSSLMODE === 'require',
      },
    },
    default: 'default',
  };
}

function parseConfigFile(filePath: string): MultiDbConfig {
  const content = readFileSync(filePath, 'utf-8');
  let parsed: MultiDbConfig;

  if (filePath.endsWith('.json')) {
    parsed = JSON.parse(content);
  } else {
    // Simple YAML parser for our specific format (no full yaml dependency needed)
    parsed = parseSimpleYaml(content);
  }

  // Expand env vars in all database configs
  const expanded: Record<string, DatabaseConfig> = {};
  for (const [name, config] of Object.entries(parsed.databases)) {
    expanded[name] = expandConfigValues(config);
  }

  return {
    databases: expanded,
    default: parsed.default ?? Object.keys(expanded)[0],
  };
}

function parseSimpleYaml(content: string): MultiDbConfig {
  // Minimal YAML parser for our config format
  const lines = content.split('\n');
  const databases: Record<string, DatabaseConfig> = {};
  let currentDb: string | null = null;
  let defaultDb: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Top-level "default: xxx"
    if (trimmed.startsWith('default:') && !line.startsWith('    ')) {
      defaultDb = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }

    // Skip "databases:" header
    if (trimmed === 'databases:') continue;

    // Database name (2-space indent, ends with :)
    const dbMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (dbMatch) {
      currentDb = dbMatch[1];
      databases[currentDb] = {};
      continue;
    }

    // Database property (4-space indent)
    if (currentDb) {
      const propMatch = line.match(/^    ([a-zA-Z_]+):\s*(.+)$/);
      if (propMatch) {
        const key = propMatch[1];
        let value: string | number | boolean = propMatch[2].trim();
        // Remove quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        // Parse numbers and booleans
        if (key === 'port') value = parseInt(value as string, 10);
        else if (key === 'ssl') value = value === 'true';
        (databases[currentDb] as Record<string, unknown>)[key] = value;
      }
    }
  }

  return { databases, default: defaultDb ?? Object.keys(databases)[0] };
}
