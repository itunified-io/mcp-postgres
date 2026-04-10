import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z, ZodRawShape } from "zod";
import { dbxExec, DbxResult } from "./executor.js";
import type { ToolDefinition } from "./plugin.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

export interface McpRuntimeOptions {
  name: string;
  version: string;
  transport: "stdio" | "sse";
  port?: number;
}

export class McpRuntime {
  private server: McpServer;
  private options: McpRuntimeOptions;
  private toolCount = 0;

  constructor(options: McpRuntimeOptions) {
    this.options = options;
    this.server = new McpServer({
      name: options.name,
      version: options.version,
    });
  }

  /**
   * Register a single tool from a ToolDefinition.
   * Wires the Zod schema to a dbxExec call automatically.
   */
  registerTool(tool: ToolDefinition): void {
    const shape = tool.inputSchema;

    this.server.tool(
      tool.name,
      tool.description,
      shape,
      async (params: Record<string, unknown>) => {
        const target = params.target as string | undefined;
        const args: Record<string, string> = {};

        for (const [k, v] of Object.entries(params)) {
          if (k === "target") continue;
          if (v !== undefined && v !== null) {
            args[k] = String(v);
          }
        }

        const result: DbxResult = await dbxExec(
          tool.domain,
          tool.action,
          args,
          { target },
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );

    this.toolCount++;
  }

  /**
   * Register multiple tools at once (typically from a plugin).
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Register a meta-tool for lazy domain loading.
   * Allows the bundle runtime to load domain plugins on demand.
   */
  registerMetaTool(
    name: string,
    handler: (domain: string) => Promise<void>,
  ): void {
    this.server.tool(
      name,
      "Load a domain plugin to register its tools",
      { domain: z.string().describe("Domain plugin to load") },
      async (params: { domain: string }) => {
        await handler(params.domain);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Domain '${params.domain}' loaded`,
                total_tools: this.toolCount,
              }),
            },
          ],
        };
      },
    );
  }

  /**
   * Start the MCP server with the configured transport.
   */
  async start(): Promise<void> {
    if (this.options.transport === "sse") {
      await this.startSSE();
    } else {
      await this.startStdio();
    }
  }

  private async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private async startSSE(): Promise<void> {
    const port = this.options.port ?? 3100;
    let sseTransport: SSEServerTransport | null = null;

    const httpServer = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === "GET" && req.url === "/sse") {
          sseTransport = new SSEServerTransport("/messages", res);
          await this.server.connect(sseTransport);
        } else if (req.method === "POST" && req.url === "/messages") {
          if (sseTransport) {
            await sseTransport.handlePostMessage(req, res);
          } else {
            res.writeHead(400);
            res.end("No SSE connection established");
          }
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      },
    );

    httpServer.listen(port, () => {
      console.error(`${this.options.name} SSE server on port ${port}`);
    });
  }
}

export function createMcpRuntime(options: McpRuntimeOptions): McpRuntime {
  return new McpRuntime(options);
}
