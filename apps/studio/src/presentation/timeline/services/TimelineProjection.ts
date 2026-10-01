import type { Document, Segment, Word } from '@tscaps/engine';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { SilencePadder } from '@core/cuts/services/SilencePadder';
import type {
  TimelineSceneExtent,
  TimelineSceneExtentResolver,
} from '@presentation/timeline/services/TimelineSceneExtentResolver';
import type {
  TimelineRowBounds,
  TimelineRowIndexResolver,
} from '@presentation/timeline/services/TimelineRowIndexResolver';
import type { TimelineSpan } from '@presentation/timeline/services/TimelineSpan';
import type { TimelineWordGapFinder } from '@presentation/timeline/services/TimelineWordGapFinder';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { TimelineSceneTones } from '@presentation/timeline/services/TimelineSceneTones';
import { TimelineWordDragTargets } from '@presentation/timeline/services/TimelineWordDragTargets';
import { TimelineSnapLandmarks } from '@presentation/timeline/services/TimelineSnapLandmarks';
import { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';

/**
 * A cell as one row draws it. `startSec`/`endSec` are clipped to that
 * row; the `full` pair is the whole thing, which is what cutting or
 * dragging it acts on.
 */
export interface TimelineCellPiece extends TimelineSpan {
  /**
   * Names the whole cell this piece was cut from, so pieces drawn rows
   * apart can be recognised as one thing.
   */
  readonly id: string;
  readonly fullStartSec: number;
  readonly fullEndSec: number;
  readonly cutAtStart: boolean;
  readonly cutAtEnd: boolean;
  /**
   * Whether this is the widest of the pieces the cell was cut into,
   * and so the one with room for anything that must be shown once per
   * cell rather than once per piece.
   */
  readonly isWidestPiece: boolean;
}

export interface TimelineWordCell extends TimelineCellPiece {
  readonly text: string;
  readonly segmentId: string;
}

/** A silence, which is a piece and nothing more. */
export type TimelineGapCell = TimelineCellPiece;

/** A stretch of time two consecutive words of one scene both claim. */
export type TimelineOverlapSpan = TimelineSpan;

/**
 * One scene's run through the timeline, as one row sees it. Its own span
 * is everything the scene occupies — its window and its words together.
 */
export interface TimelineSceneRun extends TimelineSpan {
  readonly segmentId: string;
  /**
   * The stretch the scene is shown for. Narrower than the run wherever a
   * window was shrunk past the words it holds.
   */
  readonly window: TimelineSpan;
  /** From where its first word starts to where its last one ends; `null` for a scene with no words. */
  readonly words: TimelineSpan | null;
  /** The scene's own text, for surfaces that have to name it. */
  readonly text: string;
  /** Which of the palette's tones this scene is drawn in. */
  readonly toneIndex: number;
}

export interface TimelineRow extends TimelineSpan {
  readonly index: number;
  /** Every word playing during this row, from every scene, in one channel. */
  readonly cells: ReadonlyArray<TimelineWordCell>;
  /**
   * Every scene reaching this row, in ascending start order. At most one
   * of them runs at any instant: a channel is a single sequence.
   */
  readonly sceneRuns: ReadonlyArray<TimelineSceneRun>;
  readonly overlaps: ReadonlyArray<TimelineOverlapSpan>;
  /**
   * Stretches of this row where nothing is being said by any scene.
   * Silence is a fact about the whole timeline: a pause in one scene
   * while another one speaks is not a pause.
   */
  readonly silences: ReadonlyArray<TimelineGapCell>;
}

/** A scene addressed by id, for surfaces that locate or search scenes. */
export interface TimelineScenePlacement extends TimelineSpan {
  readonly segmentId: string;
  readonly text: string;
}

export interface TimelineModel {
  /** What every row of this timeline covers. Rows are all the same length. */
  readonly rowDurationSec: number;
  readonly rows: ReadonlyArray<TimelineRow>;
  readonly scenes: ReadonlyArray<TimelineScenePlacement>;
  readonly dragTargets: TimelineWordDragTargets;
  readonly sceneDragTargets: TimelineSceneDragTargets;
  /**
   * Shared by every gesture that drags a time: word, scene, selection and
   * cut edges. One set per level, since each offers only what it draws.
   */
  readonly snapLandmarks: Readonly<Record<TimelineView, TimelineSnapLandmarks>>;
}

/** Anything cut into per-row pieces, before the cutting happens. */
interface TimelineWholeSpan extends TimelineSpan {
  readonly id: string;
}

/** A word before it is cut to the rows that draw it. */
interface TimelineWholeWord extends TimelineWholeSpan {
  readonly text: string;
  readonly segmentId: string;
}

/**
 * Projects a Document onto a timeline whose rows are equal slices of
 * the video's clock. `targetRowDurationSec` is rounded to whatever
 * divides the video evenly, so the rows partition the whole video by
 * construction: time never repeats, never goes missing, and always runs
 * forward down the stack.
 *
 * One channel is drawn at a time, its words in time order with one bar
 * running beneath them. Rows already stack downward to mean "later", so
 * a second band of anything would say "later" with its position and "at
 * the same time" with its meaning — which is why sheets that claim the
 * same instant are read in channels of their own instead.
 *
 * **A channel holds at most one scene at any instant**, so nothing here
 * has to decide which of two scenes wins: two segments of one sheet are
 * kept from sharing an instant, and sheets that share one are never in
 * the same channel. Two words of *one* scene are the exception — both
 * are drawn and the shared stretch is marked, because a scene is a
 * sequence and a pair of its words reads as a pair.
 *
 * Anything longer than a row is cut into one piece per row it crosses,
 * and each piece knows the whole it came from. Every piece of a word
 * carries the whole word's text, so a row can be read on its own.
 *
 * Silences belong to the row rather than to any scene, and are found
 * across every scene at once: a pause in one while another speaks is not
 * a pause. Their ranges come from the shared `SilencePadder`, so cutting
 * one yields the range auto-cut would.
 */
export class TimelineProjection {

  constructor(
    private readonly padder: SilencePadder,
    private readonly extentResolver: TimelineSceneExtentResolver,
    private readonly rowIndex: TimelineRowIndexResolver,
    private readonly gapFinder: TimelineWordGapFinder,
    private readonly segmentBounds: SegmentTimeBounds,
    /** How many tones a scene's colour may be picked from. */
    private readonly toneCount: number,
    private readonly minVisibleGapSec: number = 0.2,
  ) {}

  /**
   * `channelSheetIds` names the sheets this timeline draws. Everything
   * else about the projection is unchanged by it: the row grid is the
   * video's clock, not the channel's content, so the same second falls
   * in the same place whichever channel is being read. Silence is a fact
   * about the whole timeline for the same reason — a pause in one
   * channel while another one speaks is not a pause, and cutting it
   * would cut across both.
   */
  build(
    document: Document,
    videoDurationSec: number,
    targetRowDurationSec: number,
    channelSheetIds: ReadonlySet<string>,
  ): TimelineModel {
    const extents = this.extentResolver.resolve(document.getSegments());
    const drawn = this.drawnIn(document, channelSheetIds);
    const totalSec = this.totalDurationSec(extents, videoDurationSec);
    const limits = this.segmentBounds.allLimits(document, videoDurationSec);
    const tones = new TimelineSceneTones(drawn, this.toneCount);
    const base = {
      scenes: extents.map((extent) => this.placementOf(extent)),
      dragTargets: new TimelineWordDragTargets(drawn, limits),
      sceneDragTargets: new TimelineSceneDragTargets(drawn, limits, (segmentId) => tones.of(segmentId)),
      snapLandmarks: {
        words: new TimelineSnapLandmarks(drawn, 'words'),
        scenes: new TimelineSnapLandmarks(drawn, 'scenes'),
      },
    };
    // The scenes are known before the panel has been measured; the rows
    // are not, because a row is as long as the width it is drawn in.
    if (targetRowDurationSec <= 0 || totalSec <= 0) {
      return { ...base, rowDurationSec: targetRowDurationSec, rows: [] };
    }

    const rowCount = Math.max(1, Math.round(totalSec / targetRowDurationSec));
    const rowDurationSec = totalSec / rowCount;
    const bounds = this.boundsFor(rowCount, rowDurationSec, totalSec);
    return {
      ...base,
      rowDurationSec,
      rows: this.buildRows(extents, drawn, tones, totalSec, bounds),
    };
  }

  private drawnIn(document: Document, channelSheetIds: ReadonlySet<string>): TimelineSceneExtent[] {
    const segments = document.sections
      .filter((section) => channelSheetIds.has(section.kind))
      .flatMap((section) => [...section.segments]);
    return this.extentResolver.resolve(segments);
  }

  // The last row closes on `totalSec` rather than on its own multiple,
  // so repeated addition cannot leave the timeline a hair short of the
  // video's end.
  private boundsFor(rowCount: number, rowDurationSec: number, totalSec: number): TimelineRowBounds[] {
    const bounds: TimelineRowBounds[] = [];
    for (let index = 0; index < rowCount; index++) {
      bounds.push({
        startSec: index * rowDurationSec,
        endSec: index === rowCount - 1 ? totalSec : (index + 1) * rowDurationSec,
      });
    }
    return bounds;
  }

  private totalDurationSec(extents: ReadonlyArray<TimelineSceneExtent>, videoDurationSec: number): number {
    const lastSceneEndSec = extents.reduce((latest, extent) => Math.max(latest, extent.endSec), 0);
    return Math.max(videoDurationSec, lastSceneEndSec);
  }

  private placementOf(extent: TimelineSceneExtent): TimelineScenePlacement {
    return {
      segmentId: extent.segment.id,
      startSec: extent.startSec,
      endSec: extent.endSec,
      text: extent.segment.getText(),
    };
  }

  // `all` is every scene of the document and `drawn` only this channel's.
  // Words, scenes and their markings come from `drawn`; silence comes
  // from `all`, because it is a fact about the whole timeline and cutting
  // it cuts every channel at once.
  private buildRows(
    all: ReadonlyArray<TimelineSceneExtent>,
    drawn: ReadonlyArray<TimelineSceneExtent>,
    tones: TimelineSceneTones,
    totalSec: number,
    bounds: ReadonlyArray<TimelineRowBounds>,
  ): TimelineRow[] {
    const cells = this.cutIntoRows(
      this.words(drawn),
      bounds,
      (whole, bound, isWidestPiece) => this.wordPieceOf(whole, bound, isWidestPiece),
    );
    const sceneRuns = this.spreadOverRows(this.sceneRuns(drawn, tones), bounds);
    const overlaps = this.spreadOverRows(
      drawn.flatMap((extent) => this.overlapsWithin(extent)),
      bounds,
    );
    const silences = this.cutIntoRows(
      this.silences(all, totalSec),
      bounds,
      (whole, bound, isWidestPiece) => this.pieceOf(whole, bound, isWidestPiece),
    );
    return bounds.map((bound, index) => ({
      index,
      startSec: bound.startSec,
      endSec: bound.endSec,
      cells: cells[index] ?? [],
      sceneRuns: sceneRuns[index] ?? [],
      overlaps: overlaps[index] ?? [],
      silences: silences[index] ?? [],
    }));
  }

  /**
   * The scenes of one row that share an instant with another of them.
   *
   * Scenes merely following one another are not stacked, however many of
   * them a row holds — only sharing an instant lets one hide another,
   * and a row of a plain document holds several in a plain sequence.
   *
   * Needs no clipping to the row: two scenes both reaching it and
   * overlapping at all must overlap *inside* it, since a shared stretch
   * lying outside would put one of them outside too.
   */
  private words(extents: ReadonlyArray<TimelineSceneExtent>): TimelineWholeWord[] {
    return extents.flatMap((extent) => extent.segment
      .getWords()
      .map((word) => this.wordOf(word, extent.segment.id)));
  }

  private wordOf(word: Word, segmentId: string): TimelineWholeWord {
    return {
      id: word.id,
      text: word.displayText,
      segmentId,
      startSec: word.time.start,
      endSec: word.time.end,
    };
  }

  private sceneRuns(extents: ReadonlyArray<TimelineSceneExtent>, tones: TimelineSceneTones): TimelineSceneRun[] {
    return extents.map((scene) => ({
      segmentId: scene.segment.id,
      text: scene.segment.getText(),
      startSec: scene.startSec,
      endSec: scene.endSec,
      window: { startSec: scene.segment.time.start, endSec: scene.segment.time.end },
      words: this.wordSpanOf(scene.segment),
      toneIndex: tones.of(scene.segment.id),
    }));
  }

  // Words keep their order by time, so the first starts the stretch and
  // the last ends it.
  private wordSpanOf(segment: Segment): TimelineSpan | null {
    const words = segment.getWords();
    const first = words[0];
    const last = words[words.length - 1];
    if (!first || !last) return null;
    return { startSec: first.time.start, endSec: last.time.end };
  }

  /**
   * The stretches worth offering to cut: long enough to be worth a
   * chip, and padded the way every other surface pads a silence so
   * cutting one from here yields the range auto-cut would.
   */
  private silences(extents: ReadonlyArray<TimelineSceneExtent>, totalSec: number): TimelineWholeSpan[] {
    const silences: TimelineWholeSpan[] = [];
    for (const gap of this.gapFinder.find(extents, totalSec)) {
      if (gap.endSec - gap.startSec < this.minVisibleGapSec) continue;
      const range = this.padder.pad(
        gap.startSec,
        gap.endSec,
        gap.startSec <= 0,
        gap.endSec >= totalSec,
      );
      if (!range) continue;
      silences.push({
        // A silence has no identity of its own in the document, and no
        // two of them can share a stretch, so its bounds name it.
        id: `silence-${range.startSec}-${range.endSec}`,
        startSec: range.startSec,
        endSec: range.endSec,
      });
    }
    return silences;
  }

  // Two words sharing time is not a place in the sequence of cells — it
  // is something true of the pair — so it is reported apart from them.
  // Only pairs inside one scene are marked: across scenes the words
  // cannot both be drawn at all, and that is settled elsewhere.
  private overlapsWithin(scene: TimelineSceneExtent): TimelineOverlapSpan[] {
    const words = scene.segment.getWords();
    const overlaps: TimelineOverlapSpan[] = [];
    for (let index = 0; index < words.length - 1; index++) {
      const word = words[index]!;
      const next = words[index + 1]!;
      if (next.time.start < word.time.end) {
        overlaps.push({ startSec: next.time.start, endSec: word.time.end });
      }
    }
    return overlaps;
  }

  /**
   * Cuts each whole into one piece per row it crosses, using `toPiece`
   * to shape the result. Pieces come back grouped by row, one bucket
   * per bound, empty where nothing reaches.
   */
  private cutIntoRows<TWhole extends TimelineWholeSpan, TPiece>(
    wholes: ReadonlyArray<TWhole>,
    bounds: ReadonlyArray<TimelineRowBounds>,
    toPiece: (whole: TWhole, bound: TimelineRowBounds, isWidestPiece: boolean) => TPiece,
  ): TPiece[][] {
    const buckets: TPiece[][] = Array.from({ length: bounds.length }, () => []);
    for (const whole of wholes) {
      const [first, last] = this.rowRangeOf(whole, bounds);
      const widest = this.widestRowIndex(whole, bounds, first, last);
      for (let index = first; index <= last; index++) {
        buckets[index]!.push(toPiece(whole, bounds[index]!, index === widest));
      }
    }
    return buckets;
  }

  private rowRangeOf(span: TimelineSpan, bounds: ReadonlyArray<TimelineRowBounds>): [number, number] {
    const first = this.rowIndex.opening(span.startSec, bounds);
    return [first, Math.max(first, this.rowIndex.closing(span.endSec, bounds))];
  }

  private widestRowIndex(
    cell: TimelineSpan,
    bounds: ReadonlyArray<TimelineRowBounds>,
    first: number,
    last: number,
  ): number {
    let widest = first;
    let widestSec = -Infinity;
    for (let index = first; index <= last; index++) {
      const visibleSec = this.visibleDurationSec(cell, bounds[index]!);
      if (visibleSec > widestSec) {
        widestSec = visibleSec;
        widest = index;
      }
    }
    return widest;
  }

  private visibleDurationSec(cell: TimelineSpan, bound: TimelineRowBounds): number {
    return Math.min(cell.endSec, bound.endSec) - Math.max(cell.startSec, bound.startSec);
  }

  private wordPieceOf(word: TimelineWholeWord, bound: TimelineRowBounds, isWidestPiece: boolean): TimelineWordCell {
    return {
      text: word.text,
      segmentId: word.segmentId,
      ...this.pieceOf(word, bound, isWidestPiece),
    };
  }

  private pieceOf(whole: TimelineWholeSpan, bound: TimelineRowBounds, isWidestPiece: boolean): TimelineCellPiece {
    const startSec = Math.max(whole.startSec, bound.startSec);
    const endSec = Math.min(whole.endSec, bound.endSec);
    return {
      id: whole.id,
      startSec,
      endSec,
      fullStartSec: whole.startSec,
      fullEndSec: whole.endSec,
      cutAtStart: startSec > whole.startSec,
      cutAtEnd: endSec < whole.endSec,
      isWidestPiece,
    };
  }

  private spreadOverRows<T extends TimelineSpan>(
    spans: ReadonlyArray<T>,
    bounds: ReadonlyArray<TimelineRowBounds>,
  ): T[][] {
    const buckets: T[][] = Array.from({ length: bounds.length }, () => []);
    for (const span of spans) {
      const [first, last] = this.rowRangeOf(span, bounds);
      for (let index = first; index <= last; index++) buckets[index]!.push(span);
    }
    return buckets;
  }
}
