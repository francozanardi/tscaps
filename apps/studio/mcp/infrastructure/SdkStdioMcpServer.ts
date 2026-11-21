// The SDK's subpath exports map `./*` to files verbatim, so Node resolves
// these at runtime only with the extension.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpTool } from '@mcp/domain/McpTool';

/** What the server says about itself in `initialize`. */
export interface McpServerIdentity {
  readonly name: string;
  readonly version: string;
  /** Read by the agent beside the tools: the flow they make up. */
  readonly instructions: string;
}

/**
 * The MCP server over standard input and output, the way an agent on the
 * same machine starts one. A tool that rejects is answered as a tool
 * error carrying the rejection's message, so the agent reads why and
 * can act on it.
 */
export class SdkStdioMcpServer {
  private readonly byName = new Map<string, McpTool>();

  /** Throws when two tools share a name: that is a wiring mistake. */
  constructor(
    private readonly identity: McpServerIdentity,
    private readonly tools: ReadonlyArray<McpTool>,
  ) {
    for (const tool of tools) {
      if (this.byName.has(tool.name)) throw new Error(`Two tools are named ${tool.name}`);
      this.byName.set(tool.name, tool);
    }
  }

  /** Connects to standard input and output; resolves once connected. */
  async start(onClose: () => void): Promise<void> {
    const server = new Server(
      { name: this.identity.name, version: this.identity.version },
      { capabilities: { tools: {} }, instructions: this.identity.instructions },
    );
    server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: this.tools.map((tool) => this.describe(tool)) }));
    server.setRequestHandler(CallToolRequestSchema, (request) => this.call(request.params.name, request.params.arguments ?? {}));
    server.onclose = onClose;
    await server.connect(new StdioServerTransport());
  }

  private describe(tool: McpTool): Tool {
    return { name: tool.name, description: tool.description, inputSchema: tool.inputSchema as Tool['inputSchema'] };
  }

  private async call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const tool = this.byName.get(name);
    if (tool === undefined) return { content: [{ type: 'text', text: `No tool is named ${name}.` }], isError: true };
    try {
      const answer = await tool.run(args);
      return { content: answer.content.map((part) => ({ ...part })), ...(answer.isError === true ? { isError: true } : {}) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: message }], isError: true };
    }
  }
}
