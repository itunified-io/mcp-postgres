import { describe, it, expect, vi } from 'vitest';
import { connectionToolDefinitions, handleConnectionTool } from '../../src/tools/connection.js';
import type { PostgresClient } from '../../src/client/postgres-client.js';

function mockClient(overrides: Partial<PostgresClient> = {}): PostgresClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [], command: 'SELECT' }),
    queryOn: vi
      .fn()
      .mockResolvedValue({ rows: [], rowCount: 0, fields: [], command: 'SELECT' }),
    isConnected: vi.fn().mockReturnValue(true),
    getPoolStatus: vi.fn().mockResolvedValue({
      database: 'default',
      connected: true,
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    }),
    getActiveDatabase: vi.fn().mockReturnValue('default'),
    getConfiguredDatabases: vi.fn().mockReturnValue(['default', 'analytics']),
    setActiveDatabase: vi.fn(),
    ...overrides,
  } as unknown as PostgresClient;
}

describe('Connection Tool Definitions', () => {
  it('exports 6 tool definitions (includes deprecated pg_switch_database alias)', () => {
    expect(connectionToolDefinitions).toHaveLength(6);
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
    it('connects to default database', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_connect', {}, client);
      expect(result.content[0].text).toContain('Connected');
      expect(client.connect).toHaveBeenCalled();
    });

    it('connects to named database', async () => {
      const client = mockClient();
      const result = await handleConnectionTool(
        'pg_connect',
        { database: 'analytics' },
        client,
      );
      expect(result.content[0].text).toContain('analytics');
      expect(client.connect).toHaveBeenCalledWith('analytics');
    });
  });

  describe('pg_disconnect', () => {
    it('disconnects all when no database specified', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_disconnect', {}, client);
      expect(result.content[0].text).toContain('all');
      expect(client.disconnect).toHaveBeenCalledWith(undefined);
    });

    it('disconnects specific database', async () => {
      const client = mockClient();
      const result = await handleConnectionTool(
        'pg_disconnect',
        { database: 'analytics' },
        client,
      );
      expect(result.content[0].text).toContain('analytics');
      expect(client.disconnect).toHaveBeenCalledWith('analytics');
    });
  });

  describe('pg_connection_status', () => {
    it('returns pool status', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_connection_status', {}, client);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.connected).toBe(true);
      expect(parsed.totalCount).toBe(5);
    });
  });

  describe('pg_list_connections', () => {
    it('lists all configured profiles with profile field', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_list_connections', {}, client);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].profile).toBe('default');
      expect(parsed[0].active).toBe(true);
    });
  });

  describe('pg_switch_profile', () => {
    it('switches active profile', async () => {
      const client = mockClient();
      const result = await handleConnectionTool(
        'pg_switch_profile',
        { profile: 'analytics' },
        client,
      );
      expect(result.content[0].text).toContain('analytics');
      expect(client.setActiveDatabase).toHaveBeenCalledWith('analytics');
    });

    it('returns error when profile not specified', async () => {
      const client = mockClient();
      const result = await handleConnectionTool('pg_switch_profile', {}, client);
      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('pg_connect with profile param', () => {
    it('connects using profile parameter (preferred)', async () => {
      const client = mockClient();
      const result = await handleConnectionTool(
        'pg_connect',
        { profile: 'analytics' },
        client,
      );
      expect(result.content[0].text).toContain('analytics');
      expect(client.connect).toHaveBeenCalledWith('analytics');
    });

    it('prefers profile over database when both provided', async () => {
      const client = mockClient();
      await handleConnectionTool(
        'pg_connect',
        { profile: 'analytics', database: 'other' },
        client,
      );
      expect(client.connect).toHaveBeenCalledWith('analytics');
    });
  });

  describe('pg_switch_database (deprecated alias)', () => {
    it('still works with database param', async () => {
      const client = mockClient();
      const result = await handleConnectionTool(
        'pg_switch_database',
        { database: 'analytics' },
        client,
      );
      expect(result.content[0].text).toContain('analytics');
      expect(client.setActiveDatabase).toHaveBeenCalledWith('analytics');
    });
  });
});
