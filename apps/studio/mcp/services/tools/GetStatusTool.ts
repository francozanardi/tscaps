import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';

/** `get_status`: what the editor shows now. */
export class GetStatusTool implements McpTool {
  readonly name = 'get_status';
  readonly description = 'Answers what the editor shows now: whether a project is open and ready to edit, its video, and any error the editor shows.';
  readonly inputSchema = z.toJSONSchema(z.object({}), { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
  ) {}

  async run(): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('get_status'));
  }
}
