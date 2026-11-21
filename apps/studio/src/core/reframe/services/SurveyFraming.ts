import type { FramingDecision } from '@core/reframe/domain/FramingDecision';
import type { PicturePoint } from '@core/reframe/domain/PicturePoint';
import type { SurveyedPerson } from '@core/reframe/domain/TakeSurvey';
import type { FramingGeometry } from '@core/reframe/services/FramingGeometry';
import type { HeadFraming } from '@core/subject-tracking/services/HeadFraming';

// A head shorter than this in the frame, as a share of its height, is too small to read on a phone: its person is
// framed closer. Measured on the estimate a sighting gives, which runs a little over the head itself.
const SMALL_HEAD_SHARE_OF_FRAME = 0.19;
// How much closer a small person is framed: one step, so the takes of one camera come out the same size whatever
// the estimate says frame by frame, and a wide picture does not turn soft.
const CLOSER = 1.5;
// Where a point names no height, it looks at the picture's middle.
const CENTRED = 0.5;

/**
 * Turns what a frame should show into where it looks, by measure rather
 * than by eye: a person, centred across on where their head stays, with
 * the head a third of the way down, and closer where they are small in
 * the picture; or a point of the picture, centred as near as the frame
 * can get. Along an axis the frame shows whole, a person's framing names
 * where their head is: nothing moves there now, and a closer view later
 * closes in on it.
 */
export class SurveyFraming {
  constructor(private readonly heads: HeadFraming) {}

  /** The framing that shows `person` in the frame `geometry` describes, at `closeness` or, where null, as close as their size asks. */
  onPerson(person: SurveyedPerson, geometry: FramingGeometry, closeness: number | null): FramingDecision {
    const scale = closeness ?? this.closenessFor(person, geometry);
    const crop = { width: geometry.sideAt(scale, 'x'), height: geometry.sideAt(scale, 'y') };
    const centre = this.heads.centreFor(person.head, crop);
    if (scale > 1) return { x: centre.x, y: centre.y, scale };
    const cropped = geometry.croppedAxis();
    return { x: cropped === 'x' ? centre.x : person.head.x, y: cropped === 'y' ? centre.y : person.head.y, scale };
  }

  /** The framing centred on `point` (`y` null for the picture's middle) at `closeness`, or the frame's own where null. */
  onPoint(point: { readonly x: number; readonly y: number | null }, geometry: FramingGeometry, closeness: number | null): FramingDecision {
    const scale = closeness ?? 1;
    return this.decisionOf(geometry.centreFor({ x: point.x, y: point.y ?? CENTRED }, scale), scale, geometry);
  }

  /** How close a person is framed for their head to read: the frame's own closeness, or one step closer where the head is small in it. */
  private closenessFor(person: SurveyedPerson, geometry: FramingGeometry): number {
    if (person.headHeight === null || !(person.headHeight > 0)) return 1;
    return person.headHeight / geometry.sideAt(1, 'y') < SMALL_HEAD_SHARE_OF_FRAME ? CLOSER : 1;
  }

  /** The decision for a view at `scale` centred on `centre`; at the frame's own closeness the axis it does not crop says nothing. */
  private decisionOf(centre: PicturePoint, scale: number, geometry: FramingGeometry): FramingDecision {
    if (scale > 1) return { x: centre.x, y: centre.y, scale };
    return geometry.croppedAxis() === 'y' ? { x: CENTRED, y: centre.y, scale } : { x: centre.x, y: null, scale };
  }
}
