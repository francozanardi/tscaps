import { Document, Segment, TimeFragment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';

/**
 * Edits a segment's on-screen window. Stored as `customTime`; words are
 * untouched. The segment is frozen, so the next derivation does not
 * merge it back into its neighbours and drop the window with it.
 *
 * The window is held clear of the hard time of the segments **on its
 * own sheet**: two of them claiming an instant would be two texts in one
 * channel with nowhere to draw the second. Segments on other sheets are
 * not walls — sheets are exactly how a document says two things are
 * meant to be said at once, and each is read in a channel of its own.
 *
 * Their gap-free padding is not a wall either — but only because the
 * effects are re-stamped here. Writing the window without that left the
 * neighbour's padding parked where it was, so a scene grown into it ended
 * up sharing instants with a window nothing had recomputed, and a document
 * reports every segment covering an instant as active: both captions would
 * have been drawn at once.
 *
 * Shrinking past the segment's own words stays a deliberate escape
 * hatch, and callers visualize the word range to keep the consequence
 * visible. It takes nothing from anyone else.
 *
 * The video's own ends are a wall for the same reason as always: no
 * frame is rendered outside them, so a window reaching past either end
 * is time the export can only drop.
 */
export class EditSegmentTimeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly segmentBounds: SegmentTimeBounds,
  ) {}

  execute(args: { segmentId: string; start: number; end: number }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const flat = document.getSegments();
    const idx = flat.findIndex((s) => s.id === args.segmentId);
    if (idx < 0) return;

    const seg = flat[idx]!;
    const limits = this.segmentBounds.limitsFor(document, args.segmentId, snap.video.duration);
    const updated = seg.with({ customTime: this._within(args.start, args.end, limits) });
    const newDoc = this._spliceSegment(document, idx, updated);
    const restamped = this.deriver.reapplyEffects(
      newDoc, sheets, snap.video.duration, snap.decorationOverrides,
    );

    this.store.commit('segment-time:' + args.segmentId);
    this.store.patch({
      document: this.deriver.retag(restamped),
      frozenSegments: snap.frozenSegments.withStructurallyEdited([args.segmentId]),
    });
  }

  private _within(start: number, end: number, limits: WordTimeLimits): TimeFragment {
    const startSec = Math.min(Math.max(start, limits.earliestStartSec), limits.latestEndSec);
    return new TimeFragment(startSec, Math.min(Math.max(end, startSec), limits.latestEndSec));
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
