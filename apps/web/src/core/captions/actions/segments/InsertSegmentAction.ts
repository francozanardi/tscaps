import { DocumentEditor, TimeFragment } from '@tscaps/engine';
import type { Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

// Inserts a new empty segment adjacent to the anchor, claiming the
// inter-segment gap as its time window so the first keystrokes have
// room to grow. Returns the new word id for focus. Effects are reapplied
// so neighbours that had been padded across the now-occupied gap settle
// back against the new segment boundary.
export class InsertSegmentAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
  ) {}

  execute(segIdx: number, position: 'before' | 'after'): string {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return '';

    const flat = document.getSegments();
    const anchor = flat[segIdx];
    if (!anchor) return '';
    const time = this._computeGap(flat, segIdx, position, anchor);

    const { doc, wordId, segmentId } = docEditor.insertSegmentAt(document, segIdx, position, time);
    if (!wordId) return '';

    const next = this.deriver.reapplyEffects(doc, snap.sheets, snap.video.duration, snap.decorationOverrides);
    const segmentOverrides = snap.segmentOverrides.withFreeze(segmentId);

    this.store.commit();
    this.store.patch({ document: next, segmentOverrides });
    return wordId;
  }

  private _computeGap(
    flat: ReadonlyArray<Segment>,
    segIdx: number,
    position: 'before' | 'after',
    anchor: Segment,
  ): TimeFragment {
    if (position === 'before') {
      const prev = flat[segIdx - 1];
      return new TimeFragment(prev ? prev.time.end : 0, anchor.time.start);
    }
    const next = flat[segIdx + 1];
    const upper = next ? next.time.start : Math.max(anchor.time.end, this.videoDurationProvider());
    return new TimeFragment(anchor.time.end, upper);
  }
}
