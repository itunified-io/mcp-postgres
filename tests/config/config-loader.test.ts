import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/config-loader.js';
import { existsSync, readFileSync } from 'node:fs';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
}));

describe('config-loader', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
    delete process.env.POSTGRES_CONFIG_FILE;
    delete process.env.POSTGRES_CONNECTION_STRING;
    delete process.env.PGHOST;
    delete process.env.PGPORT;
    delete process.env.PGUSER;
    delete process.env.PGPASSWORD;
    delete process.env.PGDATABASE;
    delete process.env.PGSSLMODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('falls back to PG* env vars when no config file or connection string', () => {
    const config = loadConfig();
    expect(config.default).toBe('default');
    expect(config.databases.default.host).toBe('localhost');
    expect(config.databases.default.port).toBe(5432);
    expect(config.databases.default.user).toBe('postgres');
  });

  it('uses POSTGRES_CONNECTION_STRING when set', () => {
    process.env.POSTGRES_CONNECTION_STRING = 'postgresql://myhost/mydb';
    const config = loadConfig();
    expect(config.databases.default.connectionString).toBe('postgresql://myhost/mydb');
  });

  it('loads JSON config file from POSTGRES_CONFIG_FILE', () => {
    process.env.POSTGRES_CONFIG_FILE = '/tmp/test-config.json';
    vi.mocked(existsSync).mockImplementation(
      (p) => p === '/tmp/test-config.json',
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        databases: {
          prod: { host: 'prod.example.com', port: 5432, database: 'app' },
          staging: { host: 'staging.example.com', port: 5432, database: 'app' },
        },
        default: 'prod',
      }),
    );

    const config = loadConfig();
    expect(config.default).toBe('prod');
    expect(Object.keys(config.databases)).toEqual(['prod', 'staging']);
    expect(config.databases.prod.host).toBe('prod.example.com');
  });

  it('loads YAML config file', () => {
    process.env.POSTGRES_CONFIG_FILE = '/tmp/test-config.yaml';
    vi.mocked(existsSync).mockImplementation(
      (p) => p === '/tmp/test-config.yaml',
    );
    vi.mocked(readFileSync).mockReturnValue(
      `databases:
  production:
    host: db.example.com
    port: 5432
    user: admin
    password: secret
    database: myapp
    ssl: true
  staging:
    host: staging-db.example.com
    port: 5433
    database: myapp_staging
default: production
`,
    );

    const config = loadConfig();
    expect(config.default).toBe('production');
    expect(config.databases.production.host).toBe('db.example.com');
    expect(config.databases.production.port).toBe(5432);
    expect(config.databases.production.ssl).toBe(true);
    expect(config.databases.staging.host).toBe('staging-db.example.com');
    expect(config.databases.staging.port).toBe(5433);
  });

  it('expands environment variables in config values', () => {
    process.env.POSTGRES_CONFIG_FILE = '/tmp/test-config.yaml';
    process.env.MY_DB_PASSWORD = 'supersecret';
    vi.mocked(existsSync).mockImplementation(
      (p) => p === '/tmp/test-config.yaml',
    );
    vi.mocked(readFileSync).mockReturnValue(
      `databases:
  prod:
    host: db.example.com
    password: \${MY_DB_PASSWORD}
    database: myapp
default: prod
`,
    );

    const config = loadConfig();
    expect(config.databases.prod.password).toBe('supersecret');
    delete process.env.MY_DB_PASSWORD;
  });

  it('handles YAML with quoted values', () => {
    process.env.POSTGRES_CONFIG_FILE = '/tmp/test-config.yaml';
    vi.mocked(existsSync).mockImplementation(
      (p) => p === '/tmp/test-config.yaml',
    );
    vi.mocked(readFileSync).mockReturnValue(
      `databases:
  prod:
    host: "db.example.com"
    user: 'admin'
    database: myapp
default: prod
`,
    );

    const config = loadConfig();
    expect(config.databases.prod.host).toBe('db.example.com');
    expect(config.databases.prod.user).toBe('admin');
  });

  it('uses first database as default when default not specified in YAML', () => {
    process.env.POSTGRES_CONFIG_FILE = '/tmp/test-config.yaml';
    vi.mocked(existsSync).mockImplementation(
      (p) => p === '/tmp/test-config.yaml',
    );
    vi.mocked(readFileSync).mockReturnValue(
      `databases:
  first_db:
    host: db1.example.com
    database: db1
  second_db:
    host: db2.example.com
    database: db2
`,
    );

    const config = loadConfig();
    expect(config.default).toBe('first_db');
  });

  it('skips comments in YAML', () => {
    process.env.POSTGRES_CONFIG_FILE = '/tmp/test-config.yaml';
    vi.mocked(existsSync).mockImplementation(
      (p) => p === '/tmp/test-config.yaml',
    );
    vi.mocked(readFileSync).mockReturnValue(
      `# Main config
databases:
  # Production database
  prod:
    host: db.example.com
    # Port override
    port: 5433
    database: myapp
default: prod
`,
    );

    const config = loadConfig();
    expect(config.databases.prod.host).toBe('db.example.com');
    expect(config.databases.prod.port).toBe(5433);
  });
});
