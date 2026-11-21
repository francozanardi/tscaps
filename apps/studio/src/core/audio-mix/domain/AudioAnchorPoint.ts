import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';

/** An anchor and how far from it, in seconds of output time, the point sits; negative is earlier. */
export interface AudioAnchorPoint {
  readonly anchor: AudioAnchor;
  readonly offsetSec: number;
}
