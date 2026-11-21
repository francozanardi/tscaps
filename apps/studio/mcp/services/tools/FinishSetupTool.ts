import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';

/**
 * `finish_setup`: the one tool a server offers when the editor it would
 * serve is not ready (no build, or no list of its operations beside it).
 * Its description and its answer say what is missing and the commands
 * that make it, so the agent can run them or tell the person, and that
 * the server must then be restarted: the tools an agent sees are fixed
 * when it connects.
 */
export class FinishSetupTool implements McpTool {
  readonly name = 'finish_setup';
  readonly description: string;
  readonly inputSchema = { type: 'object', properties: {} };

  constructor(private readonly problem: string) {
    this.description = `tscaps cannot edit yet: ${problem} Call this tool for the steps; tell the person, or run them yourself if you can run commands.`;
  }

  async run(): Promise<McpToolAnswer> {
    return { content: [{ type: 'text', text: this.problem }], isError: true };
  }
}
