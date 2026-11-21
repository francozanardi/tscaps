import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SentenceBoundary, SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import type { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import type { ShotOpeningSilence } from '@core/shots/services/ShotOpeningPlacer';

/** A segment together with the sheet its section routes to. */
export interface PlacedSegment {
  readonly segment: Segment;
  readonly sheetId: string;
}

/**
 * A place a shot could begin, and everything known about why it would
 * be a good one.
 */
export interface ShotBoundaryCandidate extends ShotOpeningSilence {
  /** Index into the segments the candidates were built from. */
  readonly index: number;
  /** Silence between the words either side of it. */
  readonly gapSec: number;
  /** What the punctuation before it closes, where the transcription wrote any. */
  readonly closes: SentenceBoundary | null;
  /** Sentence-end probability of the last word before it; null where nothing scored it. */
  readonly boundaryScore: number | null;
  /** A role sheet — the hook, the peak — starts or ends here. */
  readonly isRoleChange: boolean;
}

/**
 * Reads every gap between consecutive segments and reports what the
 * document, and the picture, know about it. Decides nothing: a
 * candidate is a place a cut is allowed, carrying whatever signals
 * this project happens to have.
 *
 * `pictureChangesSec` are the times the source's picture changes
 * abruptly, ascending; empty where nobody looked.
 */
export class ShotBoundaryFinder {
  constructor(
    private readonly sentenceBoundaryClassifier: SentenceBoundaryClassifier,
    private readonly pictureChangeLocator: PictureChangeLocator,
  ) {}

  find(
    segments: ReadonlyArray<PlacedSegment>,
    sheets: ReadonlyArray<Sheet>,
    pictureChangesSec: ReadonlyArray<number>,
  ): ShotBoundaryCandidate[] {
    const roleSheetIds = this.roleSheetIds(sheets);
    const candidates: ShotBoundaryCandidate[] = [];
    for (let index = 1; index < segments.length; index += 1) {
      const previous = segments[index - 1]!;
      const current = segments[index]!;
      // The words' own times, not the segment's: a caption is often held
      // on screen until the next one, which would hide the silence.
      const timeSec = current.segment.wordTime.start;
      const gapStartSec = Math.min(previous.segment.wordTime.end, timeSec);
      candidates.push({
        index,
        timeSec,
        gapStartSec,
        gapSec: timeSec - gapStartSec,
        pictureChangeSec: this.pictureChangeLocator.within(pictureChangesSec, gapStartSec, timeSec),
        closes: this.closesAfter(previous.segment),
        boundaryScore: this.scoreAfter(previous.segment),
        isRoleChange: current.sheetId !== previous.sheetId
          && (roleSheetIds.has(current.sheetId) || roleSheetIds.has(previous.sheetId)),
      });
    }
    return candidates;
  }

  // A speaker sheet changes hands mid-sentence and says nothing about
  // the picture; only a sheet standing for a narrative part does.
  private roleSheetIds(sheets: ReadonlyArray<Sheet>): Set<string> {
    const ids = new Set<string>();
    for (const sheet of sheets) {
      if (sheet.role !== null) ids.add(sheet.id);
    }
    return ids;
  }

  private closesAfter(segment: Segment): SentenceBoundary | null {
    const last = this.lastWordOf(segment);
    return last ? this.sentenceBoundaryClassifier.classify(last.text) : null;
  }

  private scoreAfter(segment: Segment): number | null {
    return this.lastWordOf(segment)?.boundaryScore ?? null;
  }

  private lastWordOf(segment: Segment): Word | undefined {
    const words = segment.getWords();
    return words[words.length - 1];
  }
}
