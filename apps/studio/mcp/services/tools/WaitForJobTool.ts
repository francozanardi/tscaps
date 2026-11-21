import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { BackgroundJobs } from '@mcp/services/BackgroundJobs';
import type { JobReport } from '@mcp/services/JobReport';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({ job: z.string().min(1).describe('The job id open_video, export_video or reframe_video answered.') });
const WAIT_MS = 25_000;

/** `wait_for_job`: waits up to about 25 seconds for a job, and answers its result or where it stands. */
export class WaitForJobTool implements McpTool {
  readonly name = 'wait_for_job';
  readonly description = 'Waits up to about 25 seconds for a job open_video, export_video or reframe_video started, and answers its result once done. Call again while it is still running.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly jobs: BackgroundJobs,
    private readonly report: JobReport,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const { job } = this.args.read(ARGS, args);
    const state = await this.jobs.wait(job, WAIT_MS);
    if (state === null) throw new Error(`There is no job ${job}.`);
    return this.report.answer(job, state);
  }
}
