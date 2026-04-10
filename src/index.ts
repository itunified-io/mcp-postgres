import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { loadFromVault } from './config/vault-loader.js';
import { PostgresClient } from './client/postgres-client.js';
import { connectionToolDefinitions, handleConnectionTool } from './tools/connection.js';
import { queryToolDefinitions, handleQueryTool } from './tools/query.js';
import { schemaToolDefinitions, handleSchemaTool } from './tools/schema.js';
import { crudToolDefinitions, handleCrudTool } from './tools/crud.js';
import { serverToolDefinitions, handleServerTool } from './tools/server.js';
import { databaseToolDefinitions, handleDatabaseTool } from './tools/database.js';

const allToolDefinitions: Tool[] = ([
  ...connectionToolDefinitions,
  ...queryToolDefinitions,
  ...schemaToolDefinitions,
  ...crudToolDefinitions,
  ...serverToolDefinitions,
  ...databaseToolDefinitions,
] as unknown) as Tool[];

const toolHandlers = new Map<
  string,
  (name: string, args: Record<string, unknown>, client: PostgresClient) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
>();

for (const def of connectionToolDefinitions) toolHandlers.set(def.name, handleConnectionTool);
for (const def of queryToolDefinitions) toolHandlers.set(def.name, handleQueryTool);
for (const def of schemaToolDefinitions) toolHandlers.set(def.name, handleSchemaTool);
for (const def of crudToolDefinitions) toolHandlers.set(def.name, handleCrudTool);
for (const def of serverToolDefinitions) toolHandlers.set(def.name, handleServerTool);
for (const def of databaseToolDefinitions) toolHandlers.set(def.name, handleDatabaseTool);

// --- Vault → env vars (opportunistic, before any PG config loading) ---
await loadFromVault({
  kvPath: 'postgres/nas-keycloak',
  mapping: {
    connection_string: 'POSTGRES_CONNECTION_STRING',
    host: 'PGHOST',
    port: 'PGPORT',
    user: 'PGUSER',
    password: 'PGPASSWORD',
    database: 'PGDATABASE',
  },
});

const server = new Server(
  { name: 'mcp-postgres', version: '2026.4.10-1' },
  { capabilities: { tools: {} } },
);

const client = PostgresClient.fromEnv();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allToolDefinitions,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers.get(name);

  if (!handler) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  return handler(name, (args ?? {}) as Record<string, unknown>, client);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
