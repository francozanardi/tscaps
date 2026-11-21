import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { FileReservations } from '@mcp/domain/FileReservations';
import type { BackgroundJobs } from '@mcp/services/BackgroundJobs';
import type { JobReport } from '@mcp/services/JobReport';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { PathPolicy } from '@mcp/services/PathPolicy';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  path: z.string().min(1).describe('Where to write the video, absolute or relative to the working directory. Overwritten if it exists.'),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  quality: z.enum(['low', 'medium', 'high', 'very-high']).default('high'),
  resolution: z.union([z.literal('original'), z.object({ width: z.number().int().min(16), height: z.number().int().min(16) })]).default('original')
    .describe('"original" keeps the video\'s own size; a size only scales down: the export never scales above the source.'),
  audio: z.enum(['keep', 'discard']).default('keep'),
});

const EXPORT_TIMEOUT_MS = 3 * 60 * 60_000;
const WAIT_MS = 25_000;

/** `export_video`: renders the project to a video file. */
export class ExportVideoTool implements McpTool {
  readonly name = 'export_video';
  readonly description = [
    'Exports the project to a video file with everything burned in, through the editor\'s own export (the person sees its progress in the page).',
    'Ask the person before exporting: they may still want to change something. Answers the file once written, or a job id to pass to wait_for_job;',
    'an export takes about half the video\'s length or more.',
  ].join(' ');
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly files: FileReservations,
    private readonly paths: PathPolicy,
    private readonly jobs: BackgroundJobs,
    private readonly report: JobReport,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const { path: given, ...options } = this.args.read(ARGS, args);
    const target = this.paths.fileToWrite(given);
    const job = await this.jobs.start('export_video', () => this.export(target, options), WAIT_MS);
    return this.report.answer(job.id, job.state);
  }

  private async export(target: string, options: Omit<z.infer<typeof ARGS>, 'path'>): Promise<unknown> {
    const file = this.files.reserve(target);
    try {
      const result = (await this.pageCalls.callForJob('export_video', { file, ...options }, EXPORT_TIMEOUT_MS)) as Record<string, unknown>;
      return { ...result, file: target };
    } finally {
      await this.files.release(file);
    }
  }
}
