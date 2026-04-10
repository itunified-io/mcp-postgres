import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadFromVault } from '../../src/config/vault-loader.js';
import type { VaultLoaderOptions } from '../../src/config/vault-loader.js';

function makeEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NAS_VAULT_ADDR: 'https://vault.example.com:8200',
    NAS_VAULT_ROLE_ID: 'role-id-123',
    NAS_VAULT_SECRET_ID: 'secret-id-456',
    ...overrides,
  };
}

function mockFetch(kvData: Record<string, unknown>) {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ auth: { client_token: 'hvs.test-token' } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { data: kvData } }),
    });
}

const defaultMapping: VaultLoaderOptions['mapping'] = {
  connection_string: 'POSTGRES_CONNECTION_STRING',
  host: 'PGHOST',
  port: 'PGPORT',
  user: 'PGUSER',
  password: 'PGPASSWORD',
  database: 'PGDATABASE',
};

describe('loadFromVault', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips when NAS_VAULT_ADDR is not set', async () => {
    const env = makeEnv();
    delete (env as Record<string, string | undefined>)['NAS_VAULT_ADDR'];
    const fetchFn = vi.fn();

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('skips when NAS_VAULT_ROLE_ID is not set', async () => {
    const env = makeEnv();
    delete (env as Record<string, string | undefined>)['NAS_VAULT_ROLE_ID'];
    const fetchFn = vi.fn();

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('skips when NAS_VAULT_SECRET_ID is not set', async () => {
    const env = makeEnv();
    delete (env as Record<string, string | undefined>)['NAS_VAULT_SECRET_ID'];
    const fetchFn = vi.fn();

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('populates env vars from Vault KV data', async () => {
    const env = makeEnv();
    const fetchFn = mockFetch({
      connection_string: 'postgresql://user:pass@db.example.com:5432/mydb',
      host: 'db.example.com',
      port: '5432',
      user: 'dbuser',
      password: 'dbpass',
      database: 'mydb',
    });

    await loadFromVault({ kvPath: 'postgres/nas-keycloak', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['POSTGRES_CONNECTION_STRING']).toBe('postgresql://user:pass@db.example.com:5432/mydb');
    expect(env['PGHOST']).toBe('db.example.com');
    expect(env['PGPORT']).toBe('5432');
    expect(env['PGUSER']).toBe('dbuser');
    expect(env['PGPASSWORD']).toBe('dbpass');
    expect(env['PGDATABASE']).toBe('mydb');
  });

  it('does NOT overwrite existing env vars', async () => {
    const env = makeEnv({ POSTGRES_CONNECTION_STRING: 'existing-conn-string' });
    const fetchFn = mockFetch({
      connection_string: 'vault-conn-string',
      host: 'vault-host',
    });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['POSTGRES_CONNECTION_STRING']).toBe('existing-conn-string');
    expect(env['PGHOST']).toBe('vault-host');
  });

  it('skips empty Vault values', async () => {
    const env = makeEnv();
    const fetchFn = mockFetch({
      connection_string: '',
      host: 'db.example.com',
    });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['POSTGRES_CONNECTION_STRING']).toBeUndefined();
    expect(env['PGHOST']).toBe('db.example.com');
  });

  it('skips non-string Vault values', async () => {
    const env = makeEnv();
    const fetchFn = mockFetch({
      connection_string: 12345,
      host: 'db.example.com',
    });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['POSTGRES_CONNECTION_STRING']).toBeUndefined();
    expect(env['PGHOST']).toBe('db.example.com');
  });

  it('handles AppRole login failure gracefully', async () => {
    const env = makeEnv();
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['PGHOST']).toBeUndefined();
  });

  it('handles missing client_token gracefully', async () => {
    const env = makeEnv();
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ auth: {} }),
    });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['PGHOST']).toBeUndefined();
  });

  it('handles KV read failure gracefully', async () => {
    const env = makeEnv();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ auth: { client_token: 'hvs.token' } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['PGHOST']).toBeUndefined();
  });

  it('handles KV response missing data.data gracefully', async () => {
    const env = makeEnv();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ auth: { client_token: 'hvs.token' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['PGHOST']).toBeUndefined();
  });

  it('handles network errors gracefully', async () => {
    const env = makeEnv();
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    expect(env['PGHOST']).toBeUndefined();
  });

  it('uses custom KV mount from NAS_VAULT_KV_MOUNT', async () => {
    const env = makeEnv({ NAS_VAULT_KV_MOUNT: 'secret' });
    const fetchFn = mockFetch({ host: 'db.example.com' });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    const kvCall = fetchFn.mock.calls[1];
    expect(kvCall[0]).toBe('https://vault.example.com:8200/v1/secret/data/postgres/db');
  });

  it('sends correct AppRole login payload', async () => {
    const env = makeEnv();
    const fetchFn = mockFetch({ host: 'db.example.com' });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    const loginCall = fetchFn.mock.calls[0];
    expect(loginCall[0]).toBe('https://vault.example.com:8200/v1/auth/approle/login');
    expect(JSON.parse(loginCall[1].body)).toEqual({
      role_id: 'role-id-123',
      secret_id: 'secret-id-456',
    });
  });

  it('sends X-Vault-Token header on KV read', async () => {
    const env = makeEnv();
    const fetchFn = mockFetch({ host: 'db.example.com' });

    await loadFromVault({ kvPath: 'postgres/db', mapping: defaultMapping, env, fetchImpl: fetchFn as unknown as typeof fetch });

    const kvCall = fetchFn.mock.calls[1];
    expect(kvCall[1].headers['X-Vault-Token']).toBe('hvs.test-token');
  });
});
