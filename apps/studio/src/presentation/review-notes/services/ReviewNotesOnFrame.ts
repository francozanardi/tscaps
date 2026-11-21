import { RenderTimeMap } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteSet } from '@core/review-notes/domain/ReviewNoteSet';

/** How near the playhead a note's moment has to be for the note to show on the frame, in seconds: a few frames. */
const SHOWN_WITHIN_SEC = 0.15;

/** Notes that share one place on the scrubber, as one mark. */
export interface ReviewNoteTimelineMark {
  /** In the order they were made; the first is the one the mark opens. */
  readonly notes: ReadonlyArray<ReviewNote>;
  /** Where along the scrubber, as a share of the export's length. */
  readonly share: number;
}

/** Notes nearer than this share of the scrubber would draw one mark over another, so they share one. */
const SAME_PLACE_SHARE = 0.01;

/** Which notes the editor shows, on the frame and along the scrubber. */
export class ReviewNotesOnFrame {
  /** Where `note`'s moment lands in the export, in seconds, with the cuts taken out. */
  exportSecOf(note: ReviewNote, cuts: CutRegistry): number {
    return new RenderTimeMap(cuts.list()).toOutputTime(note.sourceSec);
  }

  /** The notes whose moment is at `sourceSec`, or a few frames from it; no other note shows, open or not. */
  shownAt(notes: ReviewNoteSet, sourceSec: number): ReadonlyArray<ReviewNote> {
    return notes.list().filter((note) => Math.abs(note.sourceSec - sourceSec) <= SHOWN_WITHIN_SEC);
  }

  /**
   * Every note, placed along the export: the cuts taken
   * out, so the marks line up with the scrubber. A note whose moment is
   * cut away sits where the cut is. Notes too close to tell apart share
   * one mark, left to right.
   */
  timelineMarks(notes: ReviewNoteSet, cuts: CutRegistry, durationSec: number): ReadonlyArray<ReviewNoteTimelineMark> {
    const timeMap = new RenderTimeMap(cuts.list());
    const outputSec = durationSec - timeMap.totalSkipDuration();
    if (outputSec <= 0) return [];
    const placed = notes.list()
      .map((note) => ({ note, share: Math.min(1, Math.max(0, timeMap.toOutputTime(note.sourceSec) / outputSec)) }))
      .sort((a, b) => a.share - b.share);
    const marks: Array<{ notes: ReviewNote[]; share: number }> = [];
    for (const { note, share } of placed) {
      const last = marks[marks.length - 1];
      if (last !== undefined && share - last.share < SAME_PLACE_SHARE) last.notes.push(note);
      else marks.push({ notes: [note], share });
    }
    return marks.map((mark) => ({ ...mark, notes: [...mark.notes].sort((a, b) => a.number - b.number) }));
  }
}
