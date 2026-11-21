import { Document, DocumentEditor, Segment, TimeFragment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type {
  WordTimeBounds,
  WordTimeLimits,
  WordTimeRange,
} from '@core/captions/services/WordTimeBounds';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';

const docEditor = new DocumentEditor();

/**
 * Updates a word's start/end time. The requested range is pulled back
 * inside the order its neighbours establish, so a word can come to
 * share time with them but never trade places — a line derives its own
 * window from its first and last word by position, and a word that
 * jumped the queue would leave that window lying.
 *
 * A word at either end of its segment has no neighbouring word to stop
 * it, and there the segment's own wall does: it may not carry its
 * segment over the hard time of the one before or after it **on the
 * same sheet**. Two segments of one sheet claiming an instant would be
 * two texts in one channel with nowhere to draw the second; sheets are
 * how a document says two things are meant to be said at once.
 *
 * When the word sits at its segment's leading or trailing non-empty
 * position, the segment's `customTime` is extended outward to keep the
 * visible window covering the word — a dragged edge word should grow
 * the scene, not narrate outside of it. Effects are reapplied so
 * time-shaping passes (e.g. gap-free padding) re-stamp against the
 * post-edit segment.
 */
export class EditWordTimeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly bounds: WordTimeBounds,
    private readonly segmentBounds: SegmentTimeBounds,
  ) {}

  execute(wordId: string, start: number, end: number): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return;

    const pos = docEditor.findWordById(document, wordId);
    if (!pos) return;

    const originalSegment = document.getSegments()[pos.segIdx]!;
    const outer = this.segmentBounds.limitsFor(document, originalSegment.id, snap.video.duration);
    const time = this._withinBounds(originalSegment, wordId, start, end, outer);
    if (!time) return;

    let newDoc = docEditor.updateWordTime(
      document, pos.segIdx, pos.lineIdx, pos.wordIdx, time.startSec, time.endSec,
    );
    newDoc = this._growCustomTimeIfNeeded(
      newDoc, originalSegment, pos.segIdx, wordId, time.startSec, time.endSec,
    );
    newDoc = this.deriver.reapplyEffects(newDoc, snap.sheets, snap.video.duration, snap.decorationOverrides);

    this.store.commit('Change word timing', 'word-time:' + wordId);
    this.store.patch({ document: newDoc });
  }

  private _withinBounds(
    segment: Segment,
    wordId: string,
    start: number,
    end: number,
    outer: WordTimeLimits,
  ): WordTimeRange | null {
    const words = segment.getWords();
    const index = words.findIndex((word) => word.id === wordId);
    if (index < 0) return null;
    const ranges = words.map((word) => ({ startSec: word.time.start, endSec: word.time.end }));
    const limits = this.bounds.limitsAt(ranges, index, outer);
    return this.bounds.clamp({ startSec: start, endSec: end }, limits);
  }

  private _growCustomTimeIfNeeded(
    doc: Document,
    originalSegment: Segment,
    segIdx: number,
    wordId: string,
    start: number,
    end: number,
  ): Document {
    if (!originalSegment.customTime) return doc;

    const edge = this._wordEdgePosition(originalSegment, wordId);
    if (edge === 'none') return doc;

    const grownStart = edge === 'first' || edge === 'only'
      ? Math.min(originalSegment.customTime.start, start)
      : originalSegment.customTime.start;
    const grownEnd = edge === 'last' || edge === 'only'
      ? Math.max(originalSegment.customTime.end, end)
      : originalSegment.customTime.end;

    if (grownStart === originalSegment.customTime.start && grownEnd === originalSegment.customTime.end) {
      return doc;
    }
    return this._replaceCustomTime(doc, segIdx, new TimeFragment(grownStart, grownEnd));
  }

  private _wordEdgePosition(segment: Segment, wordId: string): 'first' | 'last' | 'only' | 'none' {
    const flat = segment.lines.flatMap((l) => l.words);
    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < flat.length; i++) {
      if (flat[i]!.text.length > 0) { firstIdx = i; break; }
    }
    for (let i = flat.length - 1; i >= 0; i--) {
      if (flat[i]!.text.length > 0) { lastIdx = i; break; }
    }
    const idx = flat.findIndex((w) => w.id === wordId);
    if (idx < 0) return 'none';
    if (firstIdx === idx && lastIdx === idx) return 'only';
    if (firstIdx === idx) return 'first';
    if (lastIdx === idx) return 'last';
    return 'none';
  }

  private _replaceCustomTime(doc: Document, flatIdx: number, customTime: TimeFragment): Document {
    let cursor = 0;
    const sections = doc.sections.map((section) => {
      const len = section.segments.length;
      if (flatIdx < cursor || flatIdx >= cursor + len) {
        cursor += len;
        return section;
      }
      const within = flatIdx - cursor;
      cursor += len;
      const segs = section.segments.map((seg, i) => (i === within ? seg.with({ customTime }) : seg));
      return section.with({ segments: segs });
    });
    return doc.with({ sections });
  }
}
