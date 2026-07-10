import type { Document } from '@tscaps/engine';
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
    if (!state.document) return;
    const activeKinds = this.collectActiveKinds(state.document, state.video.currentTime);
    if (activeKinds.length === 0) return;
    if (state.activeSheetId !== null && activeKinds.includes(state.activeSheetId)) return;
    this.setActiveSheet.execute(activeKinds[0]!);
  };

  private collectActiveKinds(document: Document, currentTime: number): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const section of document.sections) {
      if (seen.has(section.kind)) continue;
      for (const segment of section.segments) {
        if (segment.time.contains(currentTime)) {
          out.push(section.kind);
          seen.add(section.kind);
          break;
        }
      }
    }
    return out;
  }
}
