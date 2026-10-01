import { Document, Segment, TimeFragment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';

/**
 * Moves segments through time as blocks: every word they hold, the
 * window a caller named for them, and the window an Effect computed for
 * them, travel the same distance. Nothing
 * inside a segment is stretched or reordered, so what it says and how it
 * is paced are exactly what they were.
 *
 * The distance is pulled back until no moved segment reaches a
 * same-sheet segment that stays behind, or leaves the video. The
 * segments moving together are not walls to one another.
 *
 * **Moving does not freeze anything.** Word times survive every
 * derivation on their own, and a segment carrying a named window was
 * frozen when that window was named. Freezing here would put a padlock
 * on every scene the reader ever nudged.
 *
 * Effects are re-stamped, so gap-free padding follows the segments to
 * where they landed and lets go of where they were.
 */
export class ShiftSegmentsTimeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly segmentBounds: SegmentTimeBounds,
  ) {}

  execute(args: { segmentIds: ReadonlyArray<string>; deltaSec: number }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document || snap.sheets.length === 0) return;

    const ids = new Set(args.segmentIds);
    const range = this.segmentBounds.shiftRange(document, ids, snap.video.duration);
    const deltaSec = Math.min(Math.max(args.deltaSec, range.minDeltaSec), range.maxDeltaSec);
    if (deltaSec === 0) return;

    const shifted = this._shiftAll(document, ids, deltaSec);
    const restamped = this.deriver.reapplyEffects(
      shifted, snap.sheets, snap.video.duration, snap.decorationOverrides,
    );

    this.store.commit('segment-shift:' + [...ids].join(','));
    this.store.patch({ document: this.deriver.retag(restamped) });
  }

  private _shiftAll(document: Document, ids: ReadonlySet<string>, deltaSec: number): Document {
    const sections = document.sections.map((section) => {
      if (!section.segments.some((segment) => ids.has(segment.id))) return section;
      const segments = section.segments.map((segment) => (
        ids.has(segment.id) ? this._shift(segment, deltaSec) : segment
      ));
      return section.with({ segments });
    });
    return document.with({ sections });
  }

  private _shift(segment: Segment, deltaSec: number): Segment {
    const lines = segment.lines.map((line) => line.with({
      words: line.words.map((word) => word.with({ time: this._moved(word.time, deltaSec) })),
    }));
    const customTime = segment.customTime ? this._moved(segment.customTime, deltaSec) : null;
    // The Effect's window travels too, even though re-stamping recomputes
    // it. Effects read their neighbours' windows while they run — gap-free
    // orders the segments by them and pads up to the next one's start — so
    // a window left where the segment used to be pads its neighbours
    // against a place nothing occupies any more.
    const effectTime = segment.effectTime ? this._moved(segment.effectTime, deltaSec) : null;
    return segment.with({ lines, customTime, effectTime });
  }

  private _moved(time: TimeFragment, deltaSec: number): TimeFragment {
    return new TimeFragment(time.start + deltaSec, time.end + deltaSec);
  }
}
