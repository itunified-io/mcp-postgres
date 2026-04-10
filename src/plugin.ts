import { ZodRawShape } from "zod";
import type { McpRuntime } from "./runtime.js";

/**
 * A single MCP tool definition that maps to a dbxcli subcommand.
 */
export interface ToolDefinition {
  /** MCP tool name (e.g., "oracle_session_list") */
  name: string;
  /** Human-readable description for LLM consumption */
  description: string;
  /** Zod schema shape for input validation */
  inputSchema: ZodRawShape;
  /** dbxcli domain (e.g., "db", "perf", "backup") */
  domain: string;
  /** dbxcli action within the domain (e.g., "session list") */
  action: string;
}

/**
 * Interface every domain plugin must export as default.
 * The bundle runtime calls register() to wire tools into the MCP server.
 */
export interface DbxPlugin {
  /** Plugin identifier (e.g., "oracle-ee-performance") */
  name: string;
  /** dbxcli domain for lazy loading (e.g., "perf") */
  domain: string;
  /** Required license bundle */
  requiredBundle: "free" | "core" | "ha" | "ops";
  /** Tool definitions provided by this plugin */
  tools: ToolDefinition[];
  /** Register all tools with the MCP runtime */
  register(runtime: McpRuntime): void;
}

/**
 * Helper to create a plugin with automatic tool registration.
 */
export function createPlugin(config: {
  name: string;
  domain: string;
  requiredBundle: "free" | "core" | "ha" | "ops";
  tools: ToolDefinition[];
}): DbxPlugin {
  return {
    ...config,
    register(runtime: McpRuntime): void {
      runtime.registerTools(config.tools);
    },
  };
}
