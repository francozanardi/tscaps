import { Document, Line, Segment, TimeFragment, Word, type NarrationPace } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

/**
 * Rebuilds every word's time inside a segment so the words share the
 * segment's window proportional to their natural duration (chars /
 * speaker-specific narration pace). The segment's own start/end are
 * preserved. Empty words become zero-duration markers at the cursor.
 */
export class RedistributeSegmentWordsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(segmentId: string): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const flat = document.getSegments();
    const idx = flat.findIndex((s) => s.id === segmentId);
    if (idx < 0) return;
    const segment = flat[idx]!;

    const span = segment.time.end - segment.time.start;
    if (span <= 0) return;

    const updated = this._redistribute(segment, document.narrationPace, span);
    if (!updated) return;

    const newDoc = this._spliceSegment(document, idx, updated);
    const retagged = this.deriver.retag(newDoc);
    const withEffects = this.deriver.reapplyEffects(retagged, sheets, snap.video.duration, snap.decorationOverrides);
    this.store.commit('redistribute-words:' + segmentId);
    this.store.patch({ document: withEffects });
  }

  private _redistribute(segment: Segment, pace: NarrationPace, span: number): Segment | null {
    const allWords: Word[] = segment.lines.flatMap((line) => line.words);
    const naturals = allWords.map((w) => {
      if (w.text.length === 0) return 0;
      const cps = pace.charsPerSecond(w.speakerId);
      return cps > 0 ? w.text.length / cps : 0;
    });
    const total = naturals.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;

    const scale = span / total;
    let cursor = segment.time.start;
    let flatIdx = 0;
    const newLines = segment.lines.map((line) => {
      const newWords = line.words.map((word) => {
        const dur = naturals[flatIdx]! * scale;
        const isLastOverall = flatIdx === allWords.length - 1;
        const start = cursor;
        const end = isLastOverall ? segment.time.end : cursor + dur;
        cursor = end;
        flatIdx++;
        return new Word({
          text: word.text,
          time: new TimeFragment(start, end),
          structureTags: word.structureTags,
          semanticTags: word.semanticTags,
          id: word.id,
          displayText: word.displayText,
          speakerId: word.speakerId,
        });
      });
      return new Line({ words: newWords, structureTags: line.structureTags, id: line.id });
    });
    return segment.with({ lines: newLines });
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
