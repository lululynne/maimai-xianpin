import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { assertPublicArguments, assertPublicReadTool, type PublicReadTool } from './policy.js';

export interface McpReader {
  call(name: PublicReadTool, args: Record<string, unknown>): Promise<unknown>;
}

export class McdMcpClient implements McpReader {
  private readonly client = new Client({ name: 'maimai-xianpin', version: '0.1.0' });
  private connected?: Promise<void>;

  constructor(private readonly token: string) {
    if (!token.trim()) throw new Error('MCD_MCP_TOKEN_MISSING');
  }

  private connect(): Promise<void> {
    if (!this.connected) {
      const transport = new StreamableHTTPClientTransport(new URL('https://mcp.mcd.cn'), {
        requestInit: {
          headers: { Authorization: `Bearer ${this.token}` },
          redirect: 'error',
        },
      });
      this.connected = this.client.connect(transport, { timeout: 20_000 }).catch(() => {
        this.connected = undefined;
        throw new Error('MCD_MCP_CONNECT_FAILED');
      });
    }
    return this.connected;
  }

  // Operator-side T0 only; never mount this on a visitor route.
  async listTools() {
    await this.connect();
    const tools = [];
    let cursor: string | undefined;
    do {
      const page = await this.client.listTools(cursor ? { cursor } : {}, { timeout: 20_000 });
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    return tools;
  }

  async call(name: PublicReadTool, args: Record<string, unknown>): Promise<unknown> {
    assertPublicReadTool(name);
    assertPublicArguments(args);
    await this.connect();
    try {
      return await this.client.callTool({ name, arguments: args }, undefined, { timeout: 20_000 });
    } catch {
      // Never forward SDK errors, HTTP headers or upstream account data to a visitor.
      throw new Error('MCD_MCP_READ_FAILED');
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
