import { Document, Segment, TimeFragment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

/**
 * Edits a segment's on-screen window. Stored as `customTime`; words
 * are untouched. The action does not clamp to neighbor edges or to the
 * segment's own word range — both overlap with neighbors and shrinking
 * past internal words are deliberate escape hatches. Callers visualize
 * the word range to keep the consequence visible.
 */
export class EditSegmentTimeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(args: { segmentId: string; start: number; end: number }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const flat = document.getSegments();
    const idx = flat.findIndex((s) => s.id === args.segmentId);
    if (idx < 0) return;

    const seg = flat[idx]!;
    const end = Math.max(args.end, args.start);
    const updated = seg.with({ customTime: new TimeFragment(args.start, end) });
    const newDoc = this._spliceSegment(document, idx, updated);
    const retagged = this.deriver.retag(newDoc);

    this.store.commit('segment-time:' + args.segmentId);
    this.store.patch({ document: retagged });
  }

  private _spliceSegment(document: Document, flatIdx: number, replacement: Segment): Document {
    let cursor = 0;
    const sections = document.sections.map((section) => {
      const len = section.segments.length;
      if (flatIdx < cursor || flatIdx >= cursor + len) {
        cursor += len;
        return section;
      }
      const within = flatIdx - cursor;
      cursor += len;
      const segs = section.segments.map((seg, i) => (i === within ? replacement : seg));
      return section.with({ segments: segs });
    });
    return document.with({ sections });
  }
}
