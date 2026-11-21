import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { FileReservations } from '@mcp/domain/FileReservations';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { PathPolicy } from '@mcp/services/PathPolicy';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  path: z.string().min(1).describe('Where to write the .tscaps file, absolute or relative to the working directory. Overwritten if it exists.'),
});

/** `save_project`: writes the project as a `.tscaps` file. */
export class SaveProjectTool implements McpTool {
  readonly name = 'save_project';
  readonly description = 'Saves the project in the browser and writes it as a .tscaps file (the captions, styles, shots and every edit, without the video), which the editor can import later.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly files: FileReservations,
    private readonly paths: PathPolicy,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const target = this.paths.fileToWrite(this.args.read(ARGS, args).path);
    const file = this.files.reserve(target);
    try {
      const result = (await this.pageCalls.call('save_project', { file })) as Record<string, unknown>;
      return this.answers.json({ ...result, file: target });
    } finally {
      await this.files.release(file);
    }
  }
}
