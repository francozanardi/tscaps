/**
 * A stretch of the video, in seconds of its own time, where no caption is
 * shown: a scene inside it is hidden, and no scene is built across its
 * edges.
 */
export interface CaptionlessSpan {
  readonly startSec: number;
  readonly endSec: number;
}
