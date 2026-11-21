import type { Effect } from '@modules/effect/Effect';
import { Document } from '@modules/document/Document';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';

/**
 * Extends each matching segment's end time so it does not snap shut at its
 * last word. When the next matching segment begins within `maxGapMs` the
 * segment is stretched all the way to that boundary, eliminating the
 * micro-gap. When the gap is larger (or there is no next segment at all)
 * the segment is still padded by `maxGapMs` so its tail does not feel
 * abrupt — for the final segment that extension is clamped to
 * `videoDurationSeconds` so it never spills past the end of the video.
 * `segmentFilter` scopes which segments get extended; non-matching
 * segments are still treated as barriers when looking for the next
 * boundary.
 *
 * Padding is measured from the segment's last word and written to
 * `effectTime`, which the effect never reads back. Both halves of that
 * matter: reading `time.end` would fold the previous stamp into the
 * computation and add another `maxGapMs` on every re-run, and writing
 * to `customTime` would make the stamp indistinguishable from a window
 * a caller named — at which point the only way to avoid overwriting the
 * caller is to refuse to shrink, and the padding can never follow the
 * words back down again. Owning a field of its own lets the result be
 * recomputed from nothing but word boundaries, so it grows, shrinks and
 * disappears as the words move.
 *
 * A segment carrying an explicit `customTime` is left alone: a caller
 * who named a window outranks this pass.
 *
 * A `hidden` segment takes no part at all: it is neither extended nor a
 * barrier, so the caption before it is held across the time it occupies
 * instead of leaving that time blank.
 *
 * `stopsSec` are times no extension may run past, whatever is hidden
 * after them: a segment ending before a stop is held at most up to it,
 * and one ending right at a stop is not held at all.
 */
const STOP_TOLERANCE_SEC = 0.001;

export class GapFreeEffect implements Effect {
  constructor(
    private readonly segmentFilter: (segment: Segment) => boolean = () => true,
    private readonly maxGapMs: number = 1000,
    private readonly videoDurationSeconds: number = Infinity,
    private readonly stopsSec: ReadonlyArray<number> = [],
  ) {}

  apply(document: Document): Document {
    // Document/array order is not guaranteed to match time order
    // (sections group segments independently of when they play, and
    // manual time edits can reshuffle within a section), so we sort
    // by start time first. The "next" segment is then literally the
    // next one in temporal order. `segmentFilter` only decides which
    // segments we *extend*; every painted segment still counts as a
    // barrier because we take the immediate neighbor.
    const ordered = document.getSegments()
      .filter((segment) => !segment.hidden)
      .sort((a, b) => a.time.start - b.time.start || a.time.end - b.time.end);
    const replacements = new Map<string, Segment>();
    const maxGapSeconds = this.maxGapMs / 1000;

    for (let i = 0; i < ordered.length; i++) {
      const seg = ordered[i]!;
      if (!this.segmentFilter(seg) || seg.customTime) continue;
      const next = ordered[i + 1];
      const wordTime = seg.wordTime;
      const newEnd = this.computeNewEnd(wordTime.end, next?.time.start, maxGapSeconds);
      // Null means there is no room to pad — the next segment already
      // starts at or before this one's last word. The previous stamp is
      // cleared rather than left standing: it was computed against word
      // boundaries that have since moved.
      const effectTime = newEnd === null ? null : new TimeFragment(wordTime.start, newEnd);
      if (this.sameTime(effectTime, seg.effectTime)) continue;
      replacements.set(seg.id, seg.with({ effectTime }));
    }

    if (replacements.size === 0) return document;

    const newSections = document.sections.map((section) => {
      const newSegments = section.segments.map((seg) => replacements.get(seg.id) ?? seg);
      return section.with({ segments: newSegments });
    });
    return document.with({ sections: newSections });
  }

  private sameTime(a: TimeFragment | null, b: TimeFragment | null): boolean {
    if (a === null || b === null) return a === b;
    return a.start === b.start && a.end === b.end;
  }

  private computeNewEnd(segEnd: number, nextStart: number | undefined, maxGapSeconds: number): number | null {
    const end = this.extendedEnd(segEnd, nextStart, maxGapSeconds);
    if (end === null) return null;
    // A stop right where the last word ends counts: stops tend to fall between words, exactly on a word's end.
    const stop = this.stopsSec.filter((sec) => sec >= segEnd - STOP_TOLERANCE_SEC).reduce((first, sec) => Math.min(first, sec), Infinity);
    if (end <= stop) return end;
    return stop > segEnd ? stop : null;
  }

  private extendedEnd(segEnd: number, nextStart: number | undefined, maxGapSeconds: number): number | null {
    if (nextStart !== undefined) {
      const gap = nextStart - segEnd;
      if (gap <= 0) return null;
      return gap <= maxGapSeconds ? nextStart : segEnd + maxGapSeconds;
    }
    // No next segment — pad by maxGap but never past the end of the video.
    const padded = segEnd + maxGapSeconds;
    const capped = Math.min(padded, this.videoDurationSeconds);
    return capped > segEnd ? capped : null;
  }
}
