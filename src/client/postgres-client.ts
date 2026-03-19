import pg from 'pg';
import type { PostgresConfig, QueryResult } from './types.js';
import { extractError } from '../utils/errors.js';

const { Pool } = pg;

export class PostgresClient {
  private pool: pg.Pool | null = null;
  private config: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.config = config;
  }

  static fromEnv(): PostgresClient {
    const connectionString = process.env.POSTGRES_CONNECTION_STRING;
    if (connectionString) {
      return new PostgresClient({ connectionString });
    }

    return new PostgresClient({
      host: process.env.PGHOST ?? 'localhost',
      port: parseInt(process.env.PGPORT ?? '5432', 10),
      user: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE ?? 'postgres',
      ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    });
  }

  async connect(): Promise<void> {
    if (this.pool) return;

    this.pool = new Pool({
      ...this.config,
      max: this.config.max ?? 5,
      idleTimeoutMillis: this.config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis ?? 10000,
    });

    // Test the connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) {
      throw extractError(new Error('Not connected. Call pg_connect first.'));
    }

    try {
      const result = await this.pool.query(sql, params);
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

  isConnected(): boolean {
    return this.pool !== null;
  }

  async getPoolStatus(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}
