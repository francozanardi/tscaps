import { randomBytes } from 'node:crypto';
import { BackgroundJob, type JobState } from '@mcp/services/BackgroundJob';
import { EditorPageCallFailedError } from '@mcp/domain/EditorPageCallFailedError';
import type { RunningJobs } from '@mcp/domain/RunningJobs';

// Ended jobs kept for wait_for_job to answer; past this many, the oldest ended ones are forgotten.
const KEPT_JOBS = 20;

/** A job just started: its id, and where it stood after the first wait. */
export interface StartedJob {
  readonly id: string;
  readonly state: JobState;
}

/**
 * Work that can outlast a tool call, such as an export or a video being
 * prepared: an agent's client gives up on a tool after a while (a minute,
 * for some), so the tool starts the work here and waits only so long,
 * and the agent asks again with the job's id.
 */
export class BackgroundJobs implements RunningJobs {
  private readonly jobs = new Map<string, BackgroundJob>();

  /**
   * Starts `work`, waits up to `waitMs` for it, and answers its id and
   * where it stands then. Throws, starting nothing, while another job
   * runs: the page would only take this one up after it.
   */
  async start(kind: string, work: () => Promise<unknown>, waitMs: number): Promise<StartedJob> {
    const running = this.runningJob();
    if (running !== null) throw EditorPageCallFailedError.busy(kind, running);
    const id = `${kind}-${randomBytes(4).toString('hex')}`;
    const job = new BackgroundJob(kind, work());
    for (const [doneId, done] of this.jobs) if (!done.running() && this.jobs.size >= KEPT_JOBS) this.jobs.delete(doneId);
    this.jobs.set(id, job);
    return { id, state: await job.wait(waitMs) };
  }

  runningJob(): string | null {
    for (const [id, job] of this.jobs) if (job.running()) return id;
    return null;
  }

  /** Waits up to `waitMs` for the job to end and answers where it stands; null for an unknown id. */
  async wait(id: string, waitMs: number): Promise<JobState | null> {
    return (await this.jobs.get(id)?.wait(waitMs)) ?? null;
  }
}
