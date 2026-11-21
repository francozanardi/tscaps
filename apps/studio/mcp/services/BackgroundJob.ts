/** Where a job stands: still running, done with its result, or failed with its error. */
export type JobState =
  | { readonly state: 'running'; readonly kind: string; readonly startedAt: number }
  | { readonly state: 'done'; readonly kind: string; readonly result: unknown }
  | { readonly state: 'failed'; readonly kind: string; readonly error: Error };

/** One piece of work started in the background, and how it ended once it has. */
export class BackgroundJob {
  private readonly startedAt = Date.now();
  private outcome: JobState | null = null;
  private readonly settled: Promise<void>;

  constructor(
    private readonly kind: string,
    work: Promise<unknown>,
  ) {
    this.settled = work.then(
      (result) => { this.outcome = { state: 'done', kind, result }; },
      (error: unknown) => { this.outcome = { state: 'failed', kind, error: error instanceof Error ? error : new Error(String(error)) }; },
    );
  }

  /** Whether the job has not ended yet. */
  running(): boolean {
    return this.outcome === null;
  }

  /** Waits up to `waitMs` for the job to end, and answers where it stands then. */
  async wait(waitMs: number): Promise<JobState> {
    if (this.outcome === null) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([this.settled, new Promise((resolve) => { timer = setTimeout(resolve, waitMs); })]);
      clearTimeout(timer);
    }
    return this.outcome ?? { state: 'running', kind: this.kind, startedAt: this.startedAt };
  }
}
