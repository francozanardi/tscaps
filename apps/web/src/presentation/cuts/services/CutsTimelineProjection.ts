import type { Document, Segment } from '@tscaps/engine';
import { SilencePadder } from '@core/cuts/services/SilencePadder';

export interface CutsWordCell {
  readonly kind: 'word';
  readonly id: string;
  readonly text: string;
  readonly startSec: number;
  readonly endSec: number;
}

export interface CutsGapCell {
  readonly kind: 'gap';
  readonly startSec: number;
  readonly endSec: number;
}

export type CutsCell = CutsWordCell | CutsGapCell;

export interface CutsSegmentRow {
  readonly kind: 'segment';
  readonly segmentId: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly cells: ReadonlyArray<CutsCell>;
}

export type CutsRow = CutsSegmentRow;

/**
 * Projects a Document into a flat sequence of segment rows for the
 * Cuts mode matrix. Segments are walked in chronological order
 * regardless of document order, so a document whose sections
 * interleave in time still yields a monotonic timeline.
 * Inter-segment silences are absorbed into the preceding segment's
 * row (the first segment additionally absorbs the leading silence
 * between time zero and its own start) so every second of the video
 * lives inside some row and can be cut. Word cells (and intra-segment
 * gap cells above `minVisibleGapSec`) sit inside their original time
 * positions.
 *
 * Silence gap cells delegate their range to the shared `SilencePadder`,
 * so cutting a silence from a chip yields the same range any other
 * surface (e.g. auto-cut presets) would yield for the same silence.
 */
export class CutsTimelineProjection {

  constructor(
    private readonly padder: SilencePadder,
    private readonly minVisibleGapSec: number = 0.2,
  ) {}

  build(document: Document, videoDurationSec: number): CutsRow[] {
    const segments = document.getSegments().sort((a, b) => {
      const startDelta = a.time.start - b.time.start;
      if (startDelta !== 0) return startDelta;
      return a.time.end - b.time.end;
    });
    const rows: CutsRow[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const next = segments[i + 1];
      const rowStartSec = i === 0 ? 0 : segment.time.start;
      const rowEndSec = next ? next.time.start : Math.max(segment.time.end, videoDurationSec);
      const isFirstSegment = i === 0;
      const isLastSegment = !next;
      rows.push(this.buildSegmentRow(segment, rowStartSec, rowEndSec, isFirstSegment, isLastSegment));
    }
    return rows;
  }

  private buildSegmentRow(
    segment: Segment,
    rowStartSec: number,
    rowEndSec: number,
    isFirstSegment: boolean,
    isLastSegment: boolean,
  ): CutsSegmentRow {
    const words = segment.getWords();
    const cells: CutsCell[] = [];
    const firstWord = words[0];
    if (firstWord && firstWord.time.start - rowStartSec >= this.minVisibleGapSec) {
      this.pushPaddedGap(cells, rowStartSec, firstWord.time.start, isFirstSegment, false);
    }
    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      cells.push({
        kind: 'word',
        id: word.id,
        text: word.displayText,
        startSec: word.time.start,
        endSec: word.time.end,
      });
      const next = words[i + 1];
      if (!next) continue;
      const gap = next.time.start - word.time.end;
      if (gap < this.minVisibleGapSec) continue;
      this.pushPaddedGap(cells, word.time.end, next.time.start, false, false);
    }
    const lastWord = words[words.length - 1];
    if (lastWord && rowEndSec - lastWord.time.end >= this.minVisibleGapSec) {
      this.pushPaddedGap(cells, lastWord.time.end, rowEndSec, false, isLastSegment);
    }
    return {
      kind: 'segment',
      segmentId: segment.id,
      startSec: rowStartSec,
      endSec: rowEndSec,
      cells,
    };
  }

  private pushPaddedGap(
    cells: CutsCell[],
    rawStartSec: number,
    rawEndSec: number,
    isLeadingVideoGap: boolean,
    isTrailingVideoGap: boolean,
  ): void {
    const range = this.padder.pad(rawStartSec, rawEndSec, isLeadingVideoGap, isTrailingVideoGap);
    if (!range) return;
    cells.push({ kind: 'gap', startSec: range.startSec, endSec: range.endSec });
  }
}
