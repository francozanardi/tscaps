import type { FramingDecision } from '@core/reframe/domain/FramingDecision';
import type { FramedSubject, TakeContent } from '@core/reframe/domain/TakePlan';

/**
 * A stretch of the video framed one way: a whole take, or the part of a
 * take before or after its subject switches. Seconds of the source video.
 */
export interface FramingPart {
  readonly take: number;
  readonly startSec: number;
  readonly endSec: number;
  readonly content: TakeContent;
  readonly subject: FramedSubject;
}

/**
 * A part with the framing chosen for it and the shots it was written on,
 * as refs; `follows` where their camera follows the person it frames,
 * who moves out of that framing.
 */
export interface FramedPart extends FramingPart {
  readonly framing: FramingDecision;
  readonly shots: ReadonlyArray<string>;
  readonly follows: boolean;
}
