import { EditorPageCallFailedError } from '@mcp/domain/EditorPageCallFailedError';
import type { RunningJobs } from '@mcp/domain/RunningJobs';
import type { EditorSession } from '@mcp/services/EditorSession';

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Calls a method of the editor page, opening the page first when it is
 * not open. The page answers its calls one at a time, so a call made
 * while a job runs there would wait behind the job, outlast the tool
 * call, and still be run once the job ends: `call` refuses it instead,
 * and only the job's own work goes through `callForJob`.
 */
export class PageCalls {
  constructor(
    private readonly session: EditorSession,
    private readonly jobs: RunningJobs,
  ) {}

  /** Calls `method`; throws, having sent nothing, while a job runs in the page. */
  async call(method: string, params: unknown = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const running = this.jobs.runningJob();
    if (running !== null) throw EditorPageCallFailedError.busy(method, running);
    return this.callForJob(method, params, timeoutMs);
  }

  /** Calls `method` as the work of a job, whatever else runs. */
  async callForJob(method: string, params: unknown = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const page = await this.session.page();
    return page.call(method, params, timeoutMs);
  }
}
