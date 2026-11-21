import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { ShotLayerGroupField } from '@presentation/shots/services/ShotLayerGroupForm';
import type { ShotLayerTakeoverReader } from '@presentation/shots/services/ShotLayerTakeoverReader';

/** A move from inside a box over the video, or a resize from one of its corners. */
export type ShotLayerGesture = 'move' | 'resize';

// The Layout panel's rows for a box, as it dims them: Position is the
// two centres, Size the width. A gesture is the row it stands for.
const FIELDS_BY_GESTURE: ReadonlyArray<readonly [ShotLayerGesture, ReadonlyArray<ShotLayerGroupField>]> = [
  ['move', ['centerX', 'centerY']],
  ['resize', ['width']],
];

/**
 * Says which of the preview's gestures on a box over the video its own
 * CSS has made pointless: a gesture writes the layout fields, and where
 * the CSS has taken the field a gesture writes, the write changes
 * nothing on screen.
 *
 * Asks the {@link ShotLayerTakeoverReader}, so it answers exactly what
 * the Layout panel dims: the move goes with *Position* (a hand-written
 * `left`, `right`, `top`, `bottom`, `inset`, their margins, a
 * `--layer-box-left` / `--layer-box-top`, or the centres' own
 * declarations written over), the resize with *Size* (`width`, `height`,
 * `--layer-box-width` / `--layer-box-height`, or the width's own
 * declaration). A `transform`, `translate` or `scale` takes neither: it
 * applies on top of the box the fields place, so a drag still moves and
 * sizes what is drawn.
 */
export class ShotLayerCssOwnedGestureReader {
  constructor(private readonly takeover: ShotLayerTakeoverReader) {}

  /** The gestures `style`'s CSS has taken over; none for a layer never styled. */
  read(style: ElementStyle | null): ReadonlySet<ShotLayerGesture> {
    const taken = this.takeover.read(style).layoutFields;
    return new Set(FIELDS_BY_GESTURE
      .filter(([, fields]) => fields.some((field) => taken.has(field)))
      .map(([gesture]) => gesture));
  }
}
