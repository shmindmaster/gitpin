#!/usr/bin/env node

import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runCli } from './cli';
import { registerProvePrompt } from './pin-prompt';
import { registerPinTools } from './pin-tools';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'gitpin', version: '0.5.2' });
  registerPinTools(server);
  registerProvePrompt(server);
  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[gitpin] MCP server ready (stdio) - 12 read-only pin.* tools (prove/verify product loop)');
}

function isDirectExecution(): boolean {
  if (typeof require !== 'undefined' && require.main === module) return true;
  if (process.argv[1]) {
    try {
      const mainPath = resolve(process.argv[1]);
      return mainPath === __filename || mainPath === resolve(__dirname, 'server.js');
    } catch {
      return false;
    }
  }
  return false;
}

if (isDirectExecution()) {
  const command = process.argv[2];
  const action = command === undefined ? runStdioServer() : runCli(process.argv.slice(2));
  action.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
