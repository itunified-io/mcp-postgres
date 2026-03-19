import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('PostgresClient', () => {
  it('creates from connection string', () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    expect(client).toBeDefined();
  });

  it('creates from env vars via fromEnv()', () => {
    process.env.POSTGRES_CONNECTION_STRING = 'postgresql://localhost/test';
    const client = PostgresClient.fromEnv();
    expect(client).toBeDefined();
    delete process.env.POSTGRES_CONNECTION_STRING;
  });

  it('is not connected initially', () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    expect(client.isConnected()).toBe(false);
  });

  it('connects and sets connected state', async () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    await client.connect();
    expect(client.isConnected()).toBe(true);
  });

  it('disconnects and clears connected state', async () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    await client.connect();
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('throws when querying without connection', async () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    await expect(client.query('SELECT 1')).rejects.toThrow('Not connected');
  });

  it('executes parameterized query', async () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    await client.connect();
    const result = await client.query('SELECT $1::text as name', ['test']);
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('rowCount');
    expect(result).toHaveProperty('command');
  });

  it('returns pool status', async () => {
    const client = new PostgresClient({ connectionString: 'postgresql://localhost/test' });
    await client.connect();
    const status = await client.getPoolStatus();
    expect(status).toHaveProperty('totalCount');
    expect(status).toHaveProperty('idleCount');
    expect(status).toHaveProperty('waitingCount');
  });
});
