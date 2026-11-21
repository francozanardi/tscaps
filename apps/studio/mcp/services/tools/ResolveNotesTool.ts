import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  notes: z.array(z.number().int().min(1)).min(1).describe('The numbers of the notes you did.'),
  checkpoint: z.string().min(1).optional().describe('The `checkpoint` key of the change that did them, so undoing that change brings the notes back with it.'),
});

/** `resolve_notes`: removes from the frame the person's notes the agent did. */
export class ResolveNotesTool implements McpTool {
  readonly name = 'resolve_notes';
  readonly description = 'Resolves the review notes you did, by number: each is removed from the frame. Call it once the changes are made and you looked at them. Leave out a note you did not or could not do: it stays on the frame for the person, and you say why.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('resolve_notes', this.args.read(ARGS, args)));
  }
}
