import type { ExportCancelReason } from '@core/export/domain/ExportRun';

/**
 * Holds the means to abandon the export in flight: the export pipeline
 * opens a run and hands its signal to the renderer; thin actions call
 * {@link cancel} when the reader decides to stop it.
 *
 * One run at a time. Opening a run replaces whatever the previous one
 * left behind, so a stale cancellation never reaches the next run.
 */
export class ExportCancelCoordinator {

  private controller: AbortController | null = null;
  private reason: ExportCancelReason | null = null;

  /** Opens a run and answers with the signal that abandons it. */
  begin(): AbortSignal {
    this.controller = new AbortController();
    this.reason = null;
    return this.controller.signal;
  }

  /**
   * Abandons the open run. No-op when none is open or it was already
   * abandoned, so the first reason given is the one that is kept.
   */
  cancel(reason: ExportCancelReason): void {
    if (!this.controller || this.controller.signal.aborted) return;
    this.reason = reason;
    this.controller.abort();
  }

  /**
   * Why the open run was abandoned. A run can also end in an
   * `AbortError` nobody asked for here, such as a prompt the reader
   * dismissed, and that is the reader stopping it too.
   */
  reasonForAbort(): ExportCancelReason {
    return this.reason ?? 'user';
  }

  /** Closes the run. Cancelling afterwards does nothing. */
  end(): void {
    this.controller = null;
    this.reason = null;
  }
}
