import {
  Document,
  DocumentEditor,
  Line,
  Section,
  Segment,
  Word,
  type SegmentReplacementPart,
} from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver, DocumentDeriverContext } from '@core/editor/services/DocumentDeriver';
import type {
  SegmentSheetMatcher,
  SheetMatcher,
  SheetMatcherRunResult,
  WordSheetMatcher,
} from '@core/sheet-matchers/domain/SheetMatcher';

const docEditor = new DocumentEditor();

/**
 * A maximal run of consecutive words within one segment that all share
 * the same match verdict.
 */
interface WordRun {
  readonly matches: boolean;
  readonly words: Word[];
}

/**
 * Runs a matcher against the whole document and moves what it says yes
 * to into the target sheet, in a single undoable step.
 *
 * Segment-granularity matchers move whole segments. Word-granularity
 * matchers carve contiguous runs of matching words out of their
 * segments: each run is piped under the target sheet's rules and lifted
 * in place, while the surrounding words stay behind under their
 * original sheet, keeping their line grouping. After the moves, each
 * section that ended up under the target kind is re-piped under the
 * target sheet's rules so adjacent moved content flows together as one
 * input.
 *
 * This is a positive batch-assignment; it has no concept of "removing"
 * ownership. Content already on the target sheet is never touched, and
 * neither is non-matching content.
 *
 * Returns how much moved so the caller can surface the outcome.
 */
export class RunSheetMatcherAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  /**
   * `coalesceKey` folds this run into the undo entry a caller already
   * opened with the same key, so a gesture that creates a sheet and
   * fills it in one go undoes as one step instead of leaving the empty
   * sheet behind. Omit it when the run is the whole gesture.
   */
  execute<TParams>(
    sheetId: string,
    matcher: SheetMatcher<TParams>,
    params: TParams,
    coalesceKey?: string,
  ): SheetMatcherRunResult {
    const nothingMoved: SheetMatcherRunResult = { movedCount: 0 };
    const { sheets, document, video, frozenSegments, decorationOverrides } = this.store.snapshot();
    if (!document) return nothingMoved;
    if (!video.layout) return nothingMoved;

    const targetSheet = sheets.find((s) => s.id === sheetId);
    if (!targetSheet) return nothingMoved;

    const ctx: DocumentDeriverContext = {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      frozenSegments,
      decorationOverrides,
    };

    return matcher.granularity === 'word'
      ? this._runWordMatcher(document, sheetId, targetSheet, matcher, params, ctx, coalesceKey)
      : this._runSegmentMatcher(document, sheetId, targetSheet, matcher, params, ctx, coalesceKey);
  }

  private _runSegmentMatcher<TParams>(
    document: Document,
    sheetId: string,
    targetSheet: Sheet,
    matcher: SegmentSheetMatcher<TParams>,
    params: TParams,
    ctx: DocumentDeriverContext,
    coalesceKey: string | undefined,
  ): SheetMatcherRunResult {
    // Snapshot ids first; the doc mutates as we move segments.
    const movingIds: string[] = [];
    for (const section of document.sections) {
      if (section.kind === sheetId) continue;
      for (const seg of section.segments) {
        if (!matcher.matchesSegment(seg, params)) continue;
        movingIds.push(seg.id);
      }
    }
    if (movingIds.length === 0) return { movedCount: 0 };

    this.store.commit(coalesceKey);

    let doc = document;
    let movedCount = 0;
    for (const segId of movingIds) {
      const seg = doc.getSegments().find((s) => s.id === segId);
      if (!seg) continue;
      const piped = this.deriver.runSheetPipeline([seg], targetSheet, ctx);
      if (piped.length === 0) continue;
      doc = docEditor.replaceSegmentWithKind(doc, segId, piped, sheetId);
      movedCount++;
    }

    doc = this._reflowTargetSections(doc, sheetId, targetSheet, ctx);
    this.store.patch({ document: this.deriver.retag(doc) });
    return { movedCount };
  }

  private _runWordMatcher<TParams>(
    document: Document,
    sheetId: string,
    targetSheet: Sheet,
    matcher: WordSheetMatcher<TParams>,
    params: TParams,
    ctx: DocumentDeriverContext,
    coalesceKey: string | undefined,
  ): SheetMatcherRunResult {
    // Snapshot ids first; the doc mutates as we carve segments apart.
    const movingIds: string[] = [];
    for (const section of document.sections) {
      if (section.kind === sheetId) continue;
      for (const seg of section.segments) {
        if (!seg.getWords().some((w) => matcher.matchesWord(w, params))) continue;
        movingIds.push(seg.id);
      }
    }
    if (movingIds.length === 0) return { movedCount: 0 };

    this.store.commit(coalesceKey);

    let doc = document;
    let movedCount = 0;
    for (const segId of movingIds) {
      const seg = doc.getSegments().find((s) => s.id === segId);
      if (!seg) continue;
      const originalKind = this._sectionKindOf(doc, segId);
      if (originalKind === null) continue;
      const runs = this._collectWordRuns(seg, matcher, params);
      const { parts, movedWords } = this._buildReplacementParts(seg, runs, originalKind, sheetId, targetSheet, ctx);
      if (movedWords === 0) continue;
      doc = docEditor.replaceSegmentWithSections(doc, segId, parts);
      movedCount += movedWords;
    }

    doc = this._reflowTargetSections(doc, sheetId, targetSheet, ctx);
    this.store.patch({ document: this.deriver.retag(doc) });
    return { movedCount };
  }

  private _collectWordRuns<TParams>(
    segment: Segment,
    matcher: WordSheetMatcher<TParams>,
    params: TParams,
  ): WordRun[] {
    const runs: WordRun[] = [];
    for (const word of segment.getWords()) {
      const matches = matcher.matchesWord(word, params);
      const last = runs[runs.length - 1];
      if (last && last.matches === matches) {
        last.words.push(word);
      } else {
        runs.push({ matches, words: [word] });
      }
    }
    return runs;
  }

  /**
   * Turns a segment's word runs into an ordered replacement: matching
   * runs are piped under the target sheet and routed to the target
   * kind; non-matching runs stay under the original kind, keeping the
   * original line grouping. A matching run whose pipeline yields
   * nothing falls back to staying behind, so no word is ever dropped.
   */
  private _buildReplacementParts(
    segment: Segment,
    runs: ReadonlyArray<WordRun>,
    originalKind: string,
    targetKind: string,
    targetSheet: Sheet,
    ctx: DocumentDeriverContext,
  ): { parts: SegmentReplacementPart[]; movedWords: number } {
    const parts: SegmentReplacementPart[] = [];
    let movedWords = 0;
    for (const run of runs) {
      if (run.matches) {
        const wrapped = new Segment({ lines: [new Line({ words: run.words })] });
        const piped = this.deriver.runSheetPipeline([wrapped], targetSheet, ctx);
        if (piped.length > 0) {
          parts.push({ segments: piped, kind: targetKind });
          movedWords += run.words.length;
          continue;
        }
      }
      parts.push({ segments: [this._remnantSegment(segment, run.words)], kind: originalKind });
    }
    return { parts, movedWords };
  }

  /**
   * Rebuilds the part of a segment that stays behind: the original
   * lines filtered down to the given words, empty lines dropped. Word
   * identities are preserved; line and segment identities are not.
   */
  private _remnantSegment(original: Segment, words: ReadonlyArray<Word>): Segment {
    const keptIds = new Set(words.map((w) => w.id));
    const lines: Line[] = [];
    for (const line of original.lines) {
      const kept = line.words.filter((w) => keptIds.has(w.id));
      if (kept.length > 0) lines.push(new Line({ words: kept }));
    }
    return new Segment({ lines });
  }

  private _sectionKindOf(document: Document, segmentId: string): string | null {
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (segment.id === segmentId) return section.kind;
      }
    }
    return null;
  }

  /**
   * Re-pipes every section whose `kind` matches the target so the moved
   * segments flow with their new neighbours as a single splitter input.
   * Segments the user has already styled are frozen — they stay verbatim
   * and their overrides survive the reflow.
   */
  private _reflowTargetSections(
    doc: Document,
    targetKind: string,
    targetSheet: Sheet,
    ctx: DocumentDeriverContext,
  ): Document {
    const next: Section[] = doc.sections.map((sec) => {
      if (sec.kind !== targetKind) return sec;
      const piped = this.deriver.reflowSection(sec.segments, targetSheet, ctx);
      if (piped.length === 0) return sec;
      return sec.with({ segments: piped });
    });
    return doc.with({ sections: next });
  }
}
