import type { Document, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { CharOwnership } from '@core/captions/domain/CharOwnership';
import { SegmentRecompiler, type NeighborWindow } from '@core/captions/services/SegmentRecompiler';

/**
 * Commits a textarea-driven scene edit. Called on every keystroke;
 * consecutive calls within the coalesce window collapse into one undo
 * entry per typing burst.
 *
 * Freezes the edited segment only when the edit is structural — words
 * added or removed compared to the pre-edit segment. Pure character
 * edits (typos, casing) keep the same word ids and leave the segment
 * unfrozen so a subsequent style change can still reflow it. Word
 * add/remove cascades to the splitter (char count changes), so without
 * the freeze the user's typed-in word would migrate into a neighbour
 * scene on the next derivation.
 */
export class ApplySmartSegmentEditAction {
  private readonly recompiler = new SegmentRecompiler();

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
  ) {}

  execute(args: { segmentId: string; text: string; ownership: CharOwnership }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const located = this._locate(document, args.segmentId);
    if (!located) return;

    const newSegment = this.recompiler.recompile({
      segment: located.segment,
      finalText: args.text,
      finalOwnership: args.ownership,
      pace: document.narrationPace,
      neighbors: this._neighborWindow(document, located.flatIdx),
    });
    const newDoc = this._spliceSegment(document, located.flatIdx, newSegment);
    const retagged = this.deriver.retag(newDoc);
    const withEffects = this.deriver.reapplyEffects(retagged, sheets, snap.video.duration, snap.decorationOverrides);

    const structurallyChanged = !this._sameWordIds(located.segment, newSegment);
    const segmentOverrides = structurallyChanged
      ? snap.segmentOverrides.withFreeze(newSegment.id)
      : snap.segmentOverrides;

    this.store.commit('caption-edit:' + args.segmentId);
    this.store.patch({ document: withEffects, segmentOverrides });
  }

  private _sameWordIds(prev: Segment, next: Segment): boolean {
    const a = prev.getWords();
    const b = next.getWords();
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i]!.id !== b[i]!.id) return false;
    }
    return true;
  }

  private _locate(
    document: Document,
    segmentId: string,
  ): { segment: Segment; flatIdx: number; kind: string } | null {
    const flat = document.getSegments();
    for (let i = 0; i < flat.length; i++) {
      const seg = flat[i]!;
      if (seg.id === segmentId) {
        return { segment: seg, flatIdx: i, kind: seg.getSection().kind };
      }
    }
    return null;
  }

  private _neighborWindow(document: Document, flatIdx: number): NeighborWindow {
    const flat = document.getSegments();
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
