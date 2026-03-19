import pg from 'pg';
import type { QueryResult } from './types.js';
import type { DatabaseConfig, MultiDbConfig } from '../config/config-loader.js';
import { loadConfig } from '../config/config-loader.js';
import { extractError } from '../utils/errors.js';

const { Pool } = pg;

export class PostgresClient {
  private pools: Map<string, pg.Pool> = new Map();
  private configs: Map<string, DatabaseConfig> = new Map();
  private activeDb: string;
  private defaultDb: string;

  constructor(multiConfig: MultiDbConfig) {
    this.defaultDb = multiConfig.default;
    this.activeDb = multiConfig.default;
    for (const [name, config] of Object.entries(multiConfig.databases)) {
      this.configs.set(name, config);
    }
  }

  static fromEnv(): PostgresClient {
    return new PostgresClient(loadConfig());
  }

  async connect(name?: string): Promise<void> {
    const dbName = name ?? this.activeDb;
    if (this.pools.has(dbName)) return;

    const config = this.configs.get(dbName);
    if (!config) {
      throw extractError(
        new Error(
          `Database '${dbName}' not found in configuration. Available: ${[...this.configs.keys()].join(', ')}`,
        ),
      );
    }

    const pool = new Pool({
      ...config,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    client.release();
    this.pools.set(dbName, pool);
  }

  async disconnect(name?: string): Promise<void> {
    if (name) {
      const pool = this.pools.get(name);
      if (pool) {
        await pool.end();
        this.pools.delete(name);
      }
      return;
    }
    // Disconnect all
    for (const [key, pool] of this.pools) {
      await pool.end();
      this.pools.delete(key);
    }
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.queryOn(this.activeDb, sql, params);
  }

  async queryOn(name: string, sql: string, params?: unknown[]): Promise<QueryResult> {
    const pool = this.pools.get(name);
    if (!pool) {
      throw extractError(new Error(`Not connected to '${name}'. Call pg_connect first.`));
    }

    try {
      const result = await pool.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        command: result.command,
      };
    } catch (error) {
      throw extractError(error);
    }
  }

  setActiveDatabase(name: string): void {
    if (!this.configs.has(name)) {
      throw new Error(
        `Database '${name}' not found in configuration. Available: ${[...this.configs.keys()].join(', ')}`,
      );
    }
    this.activeDb = name;
  }

  getActiveDatabase(): string {
    return this.activeDb;
  }

  getConfiguredDatabases(): string[] {
    return [...this.configs.keys()];
  }

  isConnected(name?: string): boolean {
    if (name) return this.pools.has(name);
    return this.pools.has(this.activeDb);
  }

  async getPoolStatus(name?: string): Promise<{
    database: string;
    connected: boolean;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    const dbName = name ?? this.activeDb;
    const pool = this.pools.get(dbName);
    if (!pool) {
      return {
        database: dbName,
        connected: false,
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      };
    }
    return {
      database: dbName,
      connected: true,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  }
}
