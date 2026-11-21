import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  files: z.array(z.object({
    media: z.string().min(1).describe('The file\'s id, as add_media or list_catalog (media) gives it.'),
    times: z.array(z.number().min(0)).min(1).max(8).optional().describe('For a GIF or a video: moments to see, in seconds of the file\'s own timeline. Spread over it when left out.'),
  })).min(1).max(6).describe('The files to look at, in the order to show them.'),
});

/** `look_at_media`: the person's files in the media bin, in one picture. */
export class LookAtMediaTool implements McpTool {
  readonly name = 'look_at_media';
  readonly description = 'Looks at files in the project\'s media bin as they are (pictures whole, GIFs and videos at moments of their own timeline), all in one picture with each labelled, to know what they show before using them. Up to 6 files and 12 pictures in one call; audio has no picture.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('look_at_media', this.args.read(ARGS, args)));
  }
}
