import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';

export type ExportPhase = 'awaiting-original' | 'running' | 'completed' | null;

const CONFIRMATION_HOLD_MS = 4000;

/**
 * Owns the UX state that lives around an export run: which phase the
 * full-screen surface should show, and whether a persistent success
 * toast is open. Subscribes to the export state store to detect phase
 * transitions and the clean-end edge; emits `'change'` whenever
 * observable state shifts so subscribers can re-render.
 *
 * Holds these flags off the export state store on purpose. The phase
 * decays via a timer, and the toast persists across unrelated
 * mutations — modelling them as derived store state would force
 * re-renders on every tick of those concerns.
 */
export class ExportFeedbackController extends EventTarget {

  private _phase: ExportPhase = null;
  private _toastOpen = false;
  private wasExporting = false;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly exportStore: ExportStore,
    private readonly editorStore: EditorStore,
  ) {
    super();
  }

  start(): void {
    this.exportStore.addEventListener('change', this.onExportStateChange);
    this.onExportStateChange();
  }

  stop(): void {
    this.exportStore.removeEventListener('change', this.onExportStateChange);
    this.clearConfirmTimer();
  }

  get phase(): ExportPhase {
    return this._phase;
  }

  get toastOpen(): boolean {
    return this._toastOpen;
  }

  dismissToast(): void {
    if (!this._toastOpen) return;
    this._toastOpen = false;
    this.dispatchEvent(new Event('change'));
  }

  private readonly onExportStateChange = (): void => {
    const run = this.exportStore.run;
    const isExporting = run !== null;
    let changed = false;

    if (isExporting) {
      const nextPhase: ExportPhase = run.phase === 'awaiting-original' ? 'awaiting-original' : 'running';
      if (!this.wasExporting) {
        if (this._toastOpen) this._toastOpen = false;
        this.clearConfirmTimer();
        changed = true;
      }
      if (this._phase !== nextPhase) {
        this._phase = nextPhase;
        changed = true;
      }
    } else if (this.wasExporting) {
      this.clearConfirmTimer();
      const error = this.editorStore.snapshot().error;
      const notice = this.exportStore.notice;
      if (!error && !notice) {
        this._phase = 'completed';
        this._toastOpen = true;
        this.confirmTimer = setTimeout(() => {
          this.confirmTimer = null;
          this._phase = null;
          this.dispatchEvent(new Event('change'));
        }, CONFIRMATION_HOLD_MS);
      } else {
        this._phase = null;
      }
      changed = true;
    }

    this.wasExporting = isExporting;
    if (changed) this.dispatchEvent(new Event('change'));
  };

  private clearConfirmTimer(): void {
    if (this.confirmTimer === null) return;
    clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
  }
}
