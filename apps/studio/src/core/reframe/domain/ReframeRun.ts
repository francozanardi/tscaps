import type { HistoryGroup } from '@core/editor/domain/HistoryGroup';

/** A step of the reframe, for whoever follows it: what it is doing and, where known, how far it has got. */
export interface ReframeStep {
  readonly label: string;
  readonly done?: number;
  readonly total?: number;
  readonly fraction?: number;
}

/** Where the reframe says how far it has got. */
export interface ReframeProgress {
  /** The latest step; it stands until the next one or until the reframe ends. */
  report(step: ReframeStep): void;
}

/**
 * What one reframe runs within: the checkpoint every change it makes
 * joins (`historyGroup`), the signal that stops it, and where it reports
 * its progress.
 */
export interface ReframeRun {
  readonly historyGroup: HistoryGroup;
  readonly signal: AbortSignal;
  readonly progress: ReframeProgress;
}
