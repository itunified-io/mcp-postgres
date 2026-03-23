export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | object;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
  fields: FieldInfo[];
  command: string;
}

export interface FieldInfo {
  name: string;
  dataTypeID: number;
}
