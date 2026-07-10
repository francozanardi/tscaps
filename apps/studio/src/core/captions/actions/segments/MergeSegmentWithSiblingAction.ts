import { Document, DocumentEditor, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { CharOwnership } from '@core/captions/domain/CharOwnership';
import { SegmentRecompiler, type NeighborWindow } from '@core/captions/services/SegmentRecompiler';

const docEditor = new DocumentEditor();

/**
 * `Backspace` at the start of a scene merges it with the previous one;
 * `Delete` at the end merges with the next. Cross-section merges are
 * allowed — the predecessor's section kind wins.
 */
export class MergeSegmentWithSiblingAction {
  private readonly recompiler = new SegmentRecompiler();

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
  ) {}

  execute(args: {
    segmentId: string;
    text: string;
    ownership: CharOwnership;
    direction: 'prev' | 'next';
  }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const flat = document.getSegments();
    const idx = flat.findIndex((s) => s.id === args.segmentId);
    if (idx < 0) return;

    const partnerIdx = args.direction === 'prev' ? idx - 1 : idx + 1;
    if (partnerIdx < 0 || partnerIdx >= flat.length) return;

    const current = flat[idx]!;
    const recompiled = this.recompiler.recompile({
      segment: current,
      finalText: args.text,
      finalOwnership: args.ownership,
      pace: document.narrationPace,
      neighbors: this._neighborWindow(flat, idx),
    });

    const splicedDoc = this._spliceSegment(document, idx, recompiled);
    const leadIdx = Math.min(idx, partnerIdx);
    const mergedDoc = docEditor.mergeSegmentWithNext(splicedDoc, leadIdx);
    const retagged = this.deriver.retag(mergedDoc);
    const withEffects = this.deriver.reapplyEffects(retagged, sheets, snap.video.duration, snap.decorationOverrides);

    // Freeze the merged segment so a subsequent reflow doesn't undo it.
    // `mergeSegmentWithNext` keeps the lead segment's id, so we know
    // exactly which id survived.
    const mergedSegmentId = flat[leadIdx]!.id;
    const segmentOverrides = snap.segmentOverrides.withFreeze(mergedSegmentId);

    this.store.commit();
    this.store.patch({ document: withEffects, segmentOverrides });
  }

  private _neighborWindow(flat: ReadonlyArray<Segment>, flatIdx: number): NeighborWindow {
    const prev = flat[flatIdx - 1];
    const next = flat[flatIdx + 1];
    return {
      prevEnd: prev ? prev.time.end : 0,
      nextStart: next ? next.time.start : this.videoDurationProvider(),
    };
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
