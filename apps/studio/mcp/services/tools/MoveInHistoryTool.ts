import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  to: z.string().min(1).describe('"back" to undo, "forward" to redo, or a checkpoint id from list_checkpoints to show the project as it stood there.'),
});

/** `move_in_history`: undo, redo, or go to a checkpoint. */
export class MoveInHistoryTool implements McpTool {
  readonly name = 'move_in_history';
  readonly description = 'Undoes ("back"), redoes ("forward"), or shows the project as it stood at a checkpoint, keeping every checkpoint, as the editor\'s own history does.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const { to } = this.args.read(ARGS, args);
    const target = to === 'back' || to === 'forward' ? to : { checkpoint: to };
    return this.answers.json(await this.pageCalls.call('move_in_history', { to: target }));
  }
}
