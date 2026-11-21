import type { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';

/**
 * The preprocessing runs this tab has in flight, each from the moment
 * it starts until it is over: its project saved, or the run given up.
 * A run can outlive the editor session it was started in, so this is
 * where a run the editor no longer shows can still be found.
 *
 * Subscribers listen for `'change'`, emitted when a run starts or ends,
 * and read `runs`.
 */
export class PreprocessingRunsStore extends EventTarget {
  private current: readonly PreprocessingRun[] = [];

  get runs(): readonly PreprocessingRun[] {
    return this.current;
  }

  add(run: PreprocessingRun): void {
    this.current = [...this.current, run];
    this.dispatchEvent(new Event('change'));
  }

  remove(run: PreprocessingRun): void {
    this.current = this.current.filter((candidate) => candidate !== run);
    this.dispatchEvent(new Event('change'));
  }
}
