import { describe, it, expect, vi } from 'vitest';
import { connectionToolDefinitions, handleConnectionTool } from '../../src/tools/connection.js';
import type { PostgresClient } from '../../src/client/postgres-client.js';

function mockClient(overrides: Partial<PostgresClient> = {}): PostgresClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [], command: 'SELECT' }),
    isConnected: vi.fn().mockReturnValue(true),
    getPoolStatus: vi.fn().mockResolvedValue({ totalCount: 5, idleCount: 3, waitingCount: 0 }),
    ...overrides,
  } as unknown as PostgresClient;
}

describe('Connection Tool Definitions', () => {
  it('exports 3 tool definitions', () => {
    expect(connectionToolDefinitions).toHaveLength(3);
  });

  it('all tools have pg_ prefix', () => {
    for (const tool of connectionToolDefinitions) {
      expect(tool.name).toMatch(/^pg_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of connectionToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});

describe('handleConnectionTool', () => {
  describe('pg_connect', () => {
    it('connects to database', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_connect', {}, client);
      expect(result.content[0].text).toContain('Connected');
      expect(client.connect).toHaveBeenCalled();
    });
  });

  describe('pg_disconnect', () => {
    it('disconnects from database', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_disconnect', {}, client);
      expect(result.content[0].text).toContain('Disconnected');
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('pg_connection_status', () => {
    it('returns pool status', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_connection_status', {}, client);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.connected).toBe(true);
      expect(parsed.pool.totalCount).toBe(5);
    });
  });
});
