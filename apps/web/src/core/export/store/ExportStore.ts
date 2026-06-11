import type { ExportNotice } from '@core/export/domain/ExportNotice';
import type { ExportPauseReason, ExportRun } from '@core/export/domain/ExportRun';

/**
 * Observable container for an export's lifecycle state: whether one
 * is in flight (`run`), any pause it is currently waiting on, and the
 * post-completion notice the user has yet to dismiss (`notice`).
 *
 * Kept independent of the editor store so writes during an export do
 * not invalidate the editor snapshot. Per-frame progress lives on
 * `ExportProgressStore`; this store carries the lifecycle edges.
 */
export class ExportStore extends EventTarget {

  private _run: ExportRun | null = null;
  private _notice: ExportNotice | null = null;

  get run(): ExportRun | null {
    return this._run;
  }

  get notice(): ExportNotice | null {
    return this._notice;
  }

  /** Marks an export as starting. Clears any pending notice. */
  start(): void {
    this._run = { pause: null };
    this._notice = null;
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Updates the active run's pause reason. No-op when no export is in
   * flight or when the reason already matches what is stored.
   */
  setPauseReason(reason: ExportPauseReason | null): void {
    if (this._run === null) return;
    if (this.samePause(this._run.pause, reason)) return;
    this._run = { pause: reason };
    this.dispatchEvent(new Event('change'));
  }

  /** Clears the active run and optionally surfaces a post-export notice. */
  finish(notice: ExportNotice | null): void {
    if (this._run === null && this._notice === notice) return;
    this._run = null;
    this._notice = notice;
    this.dispatchEvent(new Event('change'));
  }

  dismissNotice(): void {
    if (this._notice === null) return;
    this._notice = null;
    this.dispatchEvent(new Event('change'));
  }

  /** Clears both run and notice — used by full-state resets (project load). */
  reset(): void {
    if (this._run === null && this._notice === null) return;
    this._run = null;
    this._notice = null;
    this.dispatchEvent(new Event('change'));
  }

  private samePause(a: ExportPauseReason | null, b: ExportPauseReason | null): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.kind !== b.kind) return false;
    return a.codec === b.codec;
  }
}
