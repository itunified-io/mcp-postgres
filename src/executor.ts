#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DbxResult {
  success: boolean;
  data: unknown;
  metadata?: { duration_ms: number; target: string };
}

export interface DbxExecOptions {
  target?: string;
  format?: "json" | "table" | "yaml";
  timeout?: number;
}

/**
 * Execute a dbxcli command via execFile (no shell, no injection).
 *
 * All actual work (connection, license check, gates, audit, execution)
 * is done by the Go binary. This TypeScript layer only handles MCP
 * protocol, Zod schemas, and LLM-optimized output.
 */
export async function dbxExec(
  domain: string,
  action: string,
  args: Record<string, string> = {},
  opts: DbxExecOptions = {},
): Promise<DbxResult> {
  const cliArgs = [domain, action];

  for (const [k, v] of Object.entries(args)) {
    cliArgs.push(`--${k}`, v);
  }

  if (opts.target) cliArgs.push("--target", opts.target);
  cliArgs.push("--format", opts.format ?? "json");

  const start = Date.now();

  try {
    const { stdout } = await execFileAsync("dbxcli", cliArgs, {
      timeout: opts.timeout ?? 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as DbxResult;
    if (parsed.metadata) {
      parsed.metadata.duration_ms = Date.now() - start;
    }
    return parsed;
  } catch (err: unknown) {
    const error = err as { stderr?: string; code?: number; killed?: boolean };

    if (error.killed) {
      return {
        success: false,
        data: { error: "Command timed out", timeout_ms: opts.timeout ?? 120_000 },
      };
    }

    // Try to parse structured error from dbxcli stderr
    const message = error.stderr?.trim() || "Unknown dbxcli error";
    return {
      success: false,
      data: { error: message, exit_code: error.code ?? 1 },
    };
  }
}
