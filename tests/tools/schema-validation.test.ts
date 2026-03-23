import { describe, it, expect } from 'vitest';
import { connectionToolDefinitions } from '../../src/tools/connection.js';
import { queryToolDefinitions } from '../../src/tools/query.js';
import { schemaToolDefinitions } from '../../src/tools/schema.js';
import { crudToolDefinitions } from '../../src/tools/crud.js';
import { dbaToolDefinitions } from '../../src/tools/dba.js';
import { serverToolDefinitions } from '../../src/tools/server.js';
import { replicationToolDefinitions } from '../../src/tools/replication.js';
import { databaseToolDefinitions } from '../../src/tools/database.js';

const allTools = [
  ...connectionToolDefinitions,
  ...queryToolDefinitions,
  ...schemaToolDefinitions,
  ...crudToolDefinitions,
  ...dbaToolDefinitions,
  ...serverToolDefinitions,
  ...replicationToolDefinitions,
  ...databaseToolDefinitions,
];

describe('Tool inventory', () => {
  it('has exactly 40 tools', () => {
    expect(allTools).toHaveLength(40);
  });

  it('every tool has a name', () => {
    for (const tool of allTools) {
      expect(tool.name, `Tool missing name`).toBeTruthy();
    }
  });

  it('every tool has a description', () => {
    for (const tool of allTools) {
      expect(tool.description, `Tool ${tool.name} missing description`).toBeTruthy();
    }
  });

  it('every tool has inputSchema with type object', () => {
    for (const tool of allTools) {
      expect(tool.inputSchema, `Tool ${tool.name} missing inputSchema`).toBeDefined();
      expect(tool.inputSchema.type, `Tool ${tool.name} inputSchema.type is not 'object'`).toBe('object');
    }
  });

  it('has no duplicate tool names', () => {
    const names = allTools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all tool names start with pg_', () => {
    for (const tool of allTools) {
      expect(tool.name, `Tool ${tool.name} does not start with pg_`).toMatch(/^pg_/);
    }
  });
});

describe('Destructive tool confirm gates', () => {
  const destructiveTools = ['pg_update', 'pg_delete', 'pg_upsert', 'pg_vacuum', 'pg_reindex', 'pg_reload_config'];

  for (const toolName of destructiveTools) {
    it(`${toolName} has confirm in inputSchema properties`, () => {
      const tool = allTools.find((t) => t.name === toolName);
      expect(tool, `Tool ${toolName} not found`).toBeDefined();
      expect(tool!.inputSchema.properties, `Tool ${toolName} has no properties`).toBeDefined();
      expect(
        (tool!.inputSchema.properties as Record<string, unknown>)['confirm'],
        `Tool ${toolName} missing confirm property`,
      ).toBeDefined();
    });
  }
});
