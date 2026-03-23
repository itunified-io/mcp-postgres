import { describe, it, expect, vi } from 'vitest';
import { PostgresClient } from '../../src/client/postgres-client.js';

vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [], command: 'SELECT' }),
    end: vi.fn().mockResolvedValue(undefined),
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  };
  return { default: { Pool: vi.fn(() => mockPool) } };
});

vi.mock('../../src/config/config-loader.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    databases: { default: { connectionString: 'postgresql://localhost/test' } },
    default: 'default',
  }),
}));

function createClient(
  databases?: Record<string, { connectionString: string }>,
  defaultDb?: string,
) {
  return new PostgresClient({
    databases: databases ?? { default: { connectionString: 'postgresql://localhost/test' } },
    default: defaultDb ?? 'default',
  });
}

describe('PostgresClient', () => {
  it('creates with multi-db config', () => {
    const client = createClient();
    expect(client).toBeDefined();
  });

  it('creates from env vars via fromEnv()', () => {
    const client = PostgresClient.fromEnv();
    expect(client).toBeDefined();
  });

  it('is not connected initially', () => {
    const client = createClient();
    expect(client.isConnected()).toBe(false);
  });

  it('connects to default database', async () => {
    const client = createClient();
    await client.connect();
    expect(client.isConnected()).toBe(true);
  });

  it('connects to named database', async () => {
    const client = new PostgresClient({
      databases: {
        db1: { connectionString: 'postgresql://localhost/db1' },
        db2: { connectionString: 'postgresql://localhost/db2' },
      },
      default: 'db1',
    });
    await client.connect('db2');
    expect(client.isConnected('db2')).toBe(true);
  });

  it('throws for unknown database name', async () => {
    const client = createClient();
    await expect(client.connect('nonexistent')).rejects.toThrow('not found');
  });

  it('disconnects and clears connected state', async () => {
    const client = createClient();
    await client.connect();
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('disconnects a specific named database', async () => {
    const client = new PostgresClient({
      databases: {
        db1: { connectionString: 'postgresql://localhost/db1' },
        db2: { connectionString: 'postgresql://localhost/db2' },
      },
      default: 'db1',
    });
    await client.connect('db1');
    await client.connect('db2');
    await client.disconnect('db1');
    expect(client.isConnected('db1')).toBe(false);
    expect(client.isConnected('db2')).toBe(true);
  });

  it('throws when querying without connection', async () => {
    const client = createClient();
    await expect(client.query('SELECT 1')).rejects.toThrow('Not connected');
  });

  it('executes parameterized query', async () => {
    const client = createClient();
    await client.connect();
    const result = await client.query('SELECT $1::text as name', ['test']);
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('rowCount');
    expect(result).toHaveProperty('command');
  });

  it('switches active database', () => {
    const client = new PostgresClient({
      databases: {
        db1: { connectionString: 'postgresql://localhost/db1' },
        db2: { connectionString: 'postgresql://localhost/db2' },
      },
      default: 'db1',
    });
    expect(client.getActiveDatabase()).toBe('db1');
    client.setActiveDatabase('db2');
    expect(client.getActiveDatabase()).toBe('db2');
  });

  it('throws when switching to unknown database', () => {
    const client = createClient();
    expect(() => client.setActiveDatabase('nonexistent')).toThrow('not found');
  });

  it('lists configured databases', () => {
    const client = new PostgresClient({
      databases: {
        db1: { connectionString: 'postgresql://localhost/db1' },
        db2: { connectionString: 'postgresql://localhost/db2' },
      },
      default: 'db1',
    });
    expect(client.getConfiguredDatabases()).toEqual(['db1', 'db2']);
  });

  it('returns pool status', async () => {
    const client = createClient();
    await client.connect();
    const status = await client.getPoolStatus();
    expect(status).toHaveProperty('database');
    expect(status).toHaveProperty('connected');
    expect(status).toHaveProperty('totalCount');
  });

  it('returns disconnected pool status for unconnected database', async () => {
    const client = createClient();
    const status = await client.getPoolStatus();
    expect(status.connected).toBe(false);
    expect(status.totalCount).toBe(0);
  });
});
