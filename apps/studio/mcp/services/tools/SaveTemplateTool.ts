import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  name: z.string().min(1).describe('The template\'s name: letters, numbers, "-" or "_" only, no spaces, starting with a letter or a number.'),
  sheet: z.string().min(1).optional().describe('The caption style sheet (sheet:<id>); the active one when left out.'),
});

/** `save_template`: saves a caption style's look as a template of the person's own. */
export class SaveTemplateTool implements McpTool {
  readonly name = 'save_template';
  readonly description = 'Saves a caption style sheet\'s look as it is now (template, controls, typography, position, CSS, motion) as a new template of the person\'s own, kept in this browser for any project, and switches the sheet to it. Only when the person asks. Answers the template\'s id.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    return this.answers.json(await this.pageCalls.call('save_template', this.args.read(ARGS, args)));
  }
}
