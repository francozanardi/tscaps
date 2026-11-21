import type { FramingPart } from '@core/reframe/domain/FramingPart';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';

/**
 * What a framed part does about a person who moves: keep its fixed
 * framing (nobody to follow there, or they stay inside it); follow them,
 * with what its shots keep; or keep it because following them would
 * take too long on this device, or the people could not be looked at.
 */
export type PartFollowOutcome =
  | { readonly kind: 'fixed' }
  | { readonly kind: 'follow'; readonly follow: ShotFollow }
  | { readonly kind: 'too-long' }
  | { readonly kind: 'failed' };

/** Decides whether the camera of a framed part follows the person it frames. */
export interface PartFollower {
  /**
   * For `part`, framed on a crop of `crop` centred on `held` (shares of
   * the picture): whether the person at that framing moves out of it, and
   * if so how to follow them. Rejects with an `AbortError` once `signal`
   * fires; every other failure is an outcome.
   */
  decide(part: FramingPart, held: PicturePosition, crop: CropSize, signal: AbortSignal): Promise<PartFollowOutcome>;
}
