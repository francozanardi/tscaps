import { Document, Section, Segment, TimeFragment, type Word } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { CharOwnership } from '@core/captions/domain/CharOwnership';
import { SegmentRecompiler, type NeighborWindow } from '@core/captions/services/SegmentRecompiler';

/**
 * `Ctrl+Enter` from within a scene's textarea: splits the scene in two
 * at the textarea cursor. Each half is recompiled with its own neighbor
 * window so surviving words keep their times and inserts get heuristic
 * times bounded by the split.
 */
export class SplitSegmentAtCursorAction {
  private readonly recompiler = new SegmentRecompiler();

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
  ) {}

  execute(args: { segmentId: string; text: string; ownership: CharOwnership; cursorPos: number }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const located = this._locate(document, args.segmentId);
    if (!located) return;

    const pace = document.narrationPace;
    const neighbors = this._neighborWindow(document, located.flatIdx);

    const cursor = Math.max(0, Math.min(args.text.length, args.cursorPos));
    const textBefore = args.text.slice(0, cursor);
    const textAfter = args.text.slice(cursor);
    const ownBefore = new CharOwnership(args.ownership.mapping.slice(0, cursor));
    const ownAfter = new CharOwnership(args.ownership.mapping.slice(cursor));

    if (!/\S/.test(textBefore) || !/\S/.test(textAfter)) {
      const newSegment = this.recompiler.recompile({
        segment: located.segment,
        finalText: args.text,
        finalOwnership: args.ownership,
        pace,
        neighbors,
      });
      this._commit(this._spliceOne(document, located.flatIdx, newSegment), [newSegment.id], args.segmentId);
      return;
    }

    let firstHalf = this.recompiler.recompile({
      segment: located.segment,
      finalText: textBefore,
      finalOwnership: ownBefore,
      pace,
      neighbors,
    });
    // The first half's recompile sees the full original neighbor window
    // and so leaves `customTime.end` parked at the original end; clamp
    // back to where its narration actually finishes.
    const splitTime = this._lastWordEnd(firstHalf) ?? located.segment.time.end;
    firstHalf = firstHalf.with({ customTime: new TimeFragment(firstHalf.time.start, splitTime) });

    const seed = located.segment.with({ id: undefined, customTime: null });
    const secondHalf = this.recompiler.recompile({
      segment: seed,
      finalText: textAfter,
      finalOwnership: ownAfter,
      pace,
      neighbors: { prevEnd: splitTime, nextStart: neighbors.nextStart },
    });

    this._commit(
      this._spliceTwo(document, located.flatIdx, firstHalf, secondHalf),
      [firstHalf.id, secondHalf.id],
      args.segmentId,
    );
  }

  private _commit(newDoc: Document, freezeIds: string[], segmentId: string): void {
    const snap = this.store.snapshot();
    const retagged = this.deriver.retag(newDoc);
    const withEffects = this.deriver.reapplyEffects(retagged, snap.sheets, snap.video.duration);
    const segmentOverrides = snap.segmentOverrides.withFreezeMany(freezeIds);
    this.store.commit('caption-edit:' + segmentId);
    this.store.patch({ document: withEffects, segmentOverrides });
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

  private _lastWordEnd(segment: Segment): number | null {
    const lastLine = segment.lines[segment.lines.length - 1];
    if (!lastLine) return null;
    const words: ReadonlyArray<Word> = lastLine.words;
    const lastWord = words[words.length - 1];
    return lastWord && lastWord.text.length > 0 ? lastWord.time.end : null;
  }

  private _spliceOne(document: Document, flatIdx: number, replacement: Segment): Document {
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

  private _spliceTwo(document: Document, flatIdx: number, first: Segment, second: Segment): Document {
    let cursor = 0;
    const sections = document.sections.map((section: Section) => {
      const len = section.segments.length;
      if (flatIdx < cursor || flatIdx >= cursor + len) {
        cursor += len;
        return section;
      }
      const within = flatIdx - cursor;
      cursor += len;
      const segs = [
        ...section.segments.slice(0, within),
        first,
        second,
        ...section.segments.slice(within + 1),
      ];
      return section.with({ segments: segs });
    });
    return document.with({ sections });
  }
}
