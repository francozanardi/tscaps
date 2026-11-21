import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';

/** `list_checkpoints`: the editor's history. */
export class ListCheckpointsTool implements McpTool {
  readonly name = 'list_checkpoints';
  readonly description = 'Answers the editor\'s history, oldest first: each checkpoint\'s id, title, author (person or assistant) and key, and which one the editor shows. Changes the person made in the page show here too.';
  readonly inputSchema = z.toJSONSchema(z.object({}), { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
  ) {}

  async run(): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('list_checkpoints'));
  }
}
