import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  layer: z.string().min(1).describe('The graphic\'s layer (layer:<id>).'),
  name: z.string().min(1).describe('The preset\'s name.'),
});

/** `save_graphic_preset`: saves a graphic as a preset of the person's own. */
export class SaveGraphicPresetTool implements McpTool {
  readonly name = 'save_graphic_preset';
  readonly description = 'Saves a graphic on the video as it is now as a preset of the person\'s own, kept in this browser and listed first under list_catalog graphic_presets, to place again in any project. Only when the person asks. Answers the preset\'s id.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('save_graphic_preset', this.args.read(ARGS, args)));
  }
}
