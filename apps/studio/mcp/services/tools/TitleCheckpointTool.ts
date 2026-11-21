import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  checkpoint: z.string().min(1).describe('The `checkpoint` key the change\'s edits were run under.'),
  title: z.string().min(1).max(80).describe('What the change was, in a few words, as the person reads it in the history ("Pop on the price").'),
});

/** `title_checkpoint`: names a checkpoint in the editor's history. */
export class TitleCheckpointTool implements McpTool {
  readonly name = 'title_checkpoint';
  readonly description = 'Names the checkpoint a key made, as the person reads it in the editor\'s history. Name each change you finish, so the person can find it to undo.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('title_checkpoint', this.args.read(ARGS, args)));
  }
}
