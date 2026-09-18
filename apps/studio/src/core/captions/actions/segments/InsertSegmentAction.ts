import { DocumentEditor, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { Document } from '@tscaps/engine';
import type { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

const docEditor = new DocumentEditor();

type Insertion = ReturnType<DocumentEditor['insertSegmentAt']>;

/**
 * Inserts a new empty segment beside the anchor, claiming the room next
 * to it as its time window so the first keystrokes have somewhere to go.
 * In an empty document the first segment claims the whole video instead.
 * Returns the new word id for focus.
 *
 * **The room is measured between the neighbours' hard times**, not
 * between their drawn windows. A drawn window ends wherever gap-free
 * stopped padding, and gap-free stops at `maxGapMs` — a rule about how
 * long a caption lingers, which has nothing to say about how much space
 * a new scene deserves. Reading it left the new segment with whatever
 * the padding declined to eat: for any gap the padding closed outright,
 * a window of **zero width**.
 *
 * **The room is never longer than the anchor itself.** A gap can run to
 * the end of a long video, and a scene born that wide has to be dragged
 * back across every row of the timeline to fix — the cost of a mis-clicked
 * insert scales with the window it opens. The anchor is the reference
 * because it is what the user pointed at: the new scene is born the size
 * of the one it was inserted beside, which needs no constant and follows
 * the document's own pace. An anchor with no width of its own does not
 * cap anything.
 *
 * The first scene of an empty document is the exception and still claims
 * the whole video: with no anchor there is no `+` to have mis-clicked,
 * and the scene it produces is the only one there is to find. It also
 * has no anchor to inherit a sheet from, so it is written under the one
 * on screen.
 *
 * Effects are reapplied so neighbours that had been padded across the
 * now-occupied gap settle back against the new segment boundary.
 */
export class InsertSegmentAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
    private readonly hardTime: SegmentHardTime,
    private readonly segmentBounds: SegmentTimeBounds,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder = new CutAwareDocumentBuilder(),
  ) {}

  execute(anchorRef: string | number | null, position: 'before' | 'after'): string {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return '';

    const visibleDoc = this.cutAwareDocumentBuilder.build(document, snap.cuts);
    const visibleSegments = visibleDoc.getSegments();

    const isFirstScene = visibleSegments.length === 0 || anchorRef === null;
    const inserted = isFirstScene
      ? this._firstScene(document, snap)
      : this._sceneBeside(document, visibleDoc, visibleSegments, anchorRef, position, snap);
    if (!inserted) return '';

    const { doc, wordId, segmentId } = inserted;
    const next = this.deriver.reapplyEffects(doc, snap.sheets, snap.video.duration, snap.decorationOverrides);
    const frozenSegments = snap.frozenSegments.withStructurallyEdited([segmentId]);

    this.store.commit();
    this.store.patch({ document: next, frozenSegments });
    return wordId;
  }

  private _firstScene(document: Document, snap: EditorState): Insertion | null {
    const videoDuration = this.videoDurationProvider();
    const uncut = snap.cuts.uncutSpans(videoDuration);
    if (uncut.length === 0) return null;

    const firstSpan = uncut[0]!;
    const time = new TimeFragment(firstSpan.startSec, firstSpan.endSec);
    const sheetId = this._firstSceneSheetId(snap);

    if (document.getSegments().length === 0) {
      return docEditor.insertFirstSegment(document, time, sheetId);
    }

    const newWord = new Word({ text: '', time });
    const newSegment = new Segment({ lines: [new Line({ words: [newWord] })] });
    const sections = this._insertSegmentIntoSection(document, newSegment, sheetId);
    return {
      doc: document.with({ sections }),
      wordId: newWord.id,
      segmentId: newSegment.id,
    };
  }

  private _sceneBeside(
    document: Document,
    visibleDoc: Document,
    visibleSegments: ReadonlyArray<Segment>,
    anchorRef: string | number,
    position: 'before' | 'after',
    snap: EditorState,
  ): Insertion | null {
    const anchor = this._resolveAnchor(document, visibleSegments, anchorRef);
    if (!anchor) return null;

    const room = this._roomBeside(visibleDoc, anchor, position, snap.cuts);
    if (!room) return null;

    const anchorSection = document.sections.find((s) => s.segments.some((seg) => seg.id === anchor.id));
    if (!anchorSection) return null;

    const newWord = new Word({ text: '', time: room });
    const newSegment = new Segment({ lines: [new Line({ words: [newWord] })] });
    const sections = this._insertSegmentIntoSection(document, newSegment, anchorSection.kind, anchorSection.id);

    return {
      doc: document.with({ sections }),
      wordId: newWord.id,
      segmentId: newSegment.id,
    };
  }

  private _resolveAnchor(
    document: Document,
    visibleSegments: ReadonlyArray<Segment>,
    anchorRef: string | number,
  ): Segment | null {
    if (typeof anchorRef === 'string') {
      return visibleSegments.find((s) => s.id === anchorRef)
        ?? document.getSegments().find((s) => s.id === anchorRef)
        ?? null;
    }
    const flat = document.getSegments();
    return flat[anchorRef] ?? visibleSegments[anchorRef] ?? null;
  }

  private _insertSegmentIntoSection(
    document: Document,
    newSegment: Segment,
    sectionKind: string,
    targetSectionId?: string,
  ): ReadonlyArray<Section> {
    let inserted = false;
    const sections = document.sections.map((section) => {
      const isTarget = targetSectionId ? section.id === targetSectionId : section.kind === sectionKind;
      if (!isTarget || inserted) return section;

      const idx = section.segments.findIndex((s) => s.time.start > newSegment.time.start);
      const segments = idx === -1
        ? [...section.segments, newSegment]
        : [...section.segments.slice(0, idx), newSegment, ...section.segments.slice(idx)];
      inserted = true;
      return section.with({ segments });
    });

    if (!inserted) {
      const fresh = new Section({ kind: sectionKind, segments: [newSegment] });
      return [...document.sections, fresh];
    }
    return sections;
  }

  /**
   * Sheet the first scene of an empty document is written under: the
   * one on screen, which is what the user is looking at, and Main when
   * that one is gone. A section naming a sheet nobody owns is dropped
   * the next time the document is derived, and a scene dropped that way
   * still shows in the transcript while nothing paints it.
   */
  private _firstSceneSheetId(snap: EditorState): string {
    const active = snap.activeSheetId;
    if (active !== null && snap.sheets.some((sheet) => sheet.id === active)) return active;
    return MAIN_SHEET_ID;
  }

  private _roomBeside(
    visibleDoc: Document,
    anchor: Segment,
    position: 'before' | 'after',
    cuts: CutRegistry,
  ): TimeFragment | null {
    const videoDurationSec = this.videoDurationProvider();
    const limits = this.segmentBounds.limitsFor(visibleDoc, anchor.id, videoDurationSec);
    return position === 'before'
      ? this._roomBefore(anchor, limits, cuts)
      : this._roomAfter(anchor, limits, cuts, videoDurationSec);
  }

  private _roomBefore(
    anchor: Segment,
    limits: WordTimeLimits,
    cuts: CutRegistry,
  ): TimeFragment | null {
    const anchorHard = this.hardTime.of(anchor);
    const rawEndSec = anchorHard ? anchorHard.start : anchor.time.start;
    const endSec = cuts.prevUncutTime(rawEndSec);

    const prevCutEnd = cuts.prevCutEnd(endSec) ?? 0;
    const minStartSec = Math.max(limits.earliestStartSec, prevCutEnd, 0);

    const longest = this._longestSec(anchor);
    const startSec = Math.max(minStartSec, endSec - longest);

    if (endSec <= startSec) return null;
    return new TimeFragment(startSec, endSec);
  }

  private _roomAfter(
    anchor: Segment,
    limits: WordTimeLimits,
    cuts: CutRegistry,
    videoDurationSec: number,
  ): TimeFragment | null {
    const anchorHard = this.hardTime.of(anchor);
    const rawStartSec = anchorHard ? anchorHard.end : anchor.time.end;
    const startSec = cuts.nextUncutTime(rawStartSec);

    const effectiveDurationSec = videoDurationSec > 0 ? videoDurationSec : Number.POSITIVE_INFINITY;
    const openEndSec = Number.isFinite(limits.latestEndSec)
      ? limits.latestEndSec
      : Math.max(startSec, effectiveDurationSec);
    const latestCutStart = cuts.nextCutStart(startSec) ?? effectiveDurationSec;
    const maxEndSec = Math.min(openEndSec, latestCutStart, effectiveDurationSec);

    const longest = this._longestSec(anchor);
    const endSec = Math.min(maxEndSec, startSec + longest);

    if (endSec <= startSec) return null;
    return new TimeFragment(startSec, endSec);
  }

  /**
   * How long a scene inserted beside `anchor` may be. An anchor with no
   * width of its own imposes no limit, leaving the room untouched.
   */
  private _longestSec(anchor: Segment): number {
    const drawnSec = anchor.time.end - anchor.time.start;
    return drawnSec > 0 ? drawnSec : Number.POSITIVE_INFINITY;
  }
}
