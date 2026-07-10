import { Document, DocumentEditor, Segment, TimeFragment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

/**
 * Updates a word's start/end time. When the word sits at its segment's
 * leading or trailing non-empty position, the segment's `customTime` is
 * extended outward to keep the visible window covering the word — a
 * dragged edge word should grow the scene, not narrate outside of it.
 * Effects are reapplied so time-shaping passes (e.g. gap-free padding)
 * re-stamp against the post-edit segment.
 */
export class EditWordTimeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(wordId: string, start: number, end: number): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return;

    const pos = docEditor.findWordById(document, wordId);
    if (!pos) return;

    const originalSegment = document.getSegments()[pos.segIdx]!;
    let newDoc = docEditor.updateWordTime(document, pos.segIdx, pos.lineIdx, pos.wordIdx, start, end);
    newDoc = this._growCustomTimeIfNeeded(newDoc, originalSegment, pos.segIdx, wordId, start, end);
    newDoc = this.deriver.reapplyEffects(newDoc, snap.sheets, snap.video.duration, snap.decorationOverrides);

    this.store.commit('word-time:' + wordId);
    this.store.patch({ document: newDoc });
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
