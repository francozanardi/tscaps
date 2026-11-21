import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  query: z.string().min(1).optional().describe('What to look for, in English: a few keywords or a short question.'),
  article: z.string().min(1).optional().describe('An article id from an earlier answer, to read the whole article.'),
}).refine((args) => (args.query === undefined) !== (args.article === undefined), { message: 'give query or article, one of them' });

/** `search_help`: the editor's help. */
export class SearchHelpTool implements McpTool {
  readonly name = 'search_help';
  readonly description = 'Searches the help of the tscaps editor: how to do something in it by hand, what a part of it is, how it works (keyboard shortcuts, exporting, projects, and more). Use it before answering the person\'s questions about the editor. `query` in English answers the best matching sections, each under its article id; `article` reads one article whole.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const { text } = (await this.pageCalls.call('search_help', this.args.read(ARGS, args))) as { text: string };
    return this.answers.text(text);
  }
}
