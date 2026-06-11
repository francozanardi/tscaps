import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';

/**
 * Keeps the active sheet aligned with the playing audio: whenever
 * playback enters a span where the current active sheet has no live
 * segment but other sheets do, the active sheet switches to the first
 * sheet that does. A user who is editing one layer while another's
 * segment plays alongside keeps their selection.
 */
export class ActiveSheetAutoSwitcher {

  constructor(
    private readonly store: EditorStore,
    private readonly setActiveSheet: SetActiveSheetAction,
  ) {}

  start(): void {
    this.store.addEventListener('timechange', this.onTime);
  }

  stop(): void {
    this.store.removeEventListener('timechange', this.onTime);
  }

  private readonly onTime = (): void => {
    const state = this.store.snapshot();
    const active = state.document?.getActiveSegments(state.video.currentTime) ?? [];
    if (active.length === 0) return;
    const activeKinds = new Set(active.map((s) => s.getSection().kind));
    if (state.activeSheetId !== null && activeKinds.has(state.activeSheetId)) return;
    this.setActiveSheet.execute(active[0]!.getSection().kind);
  };
}
