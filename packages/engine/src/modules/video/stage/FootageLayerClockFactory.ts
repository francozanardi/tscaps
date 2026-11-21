import type { FootageStyle } from '@modules/video/FootageStyle';
import type { FootageLayerClock } from '@modules/video/stage/FootageLayerClock';

/** Opens the {@link FootageLayerClock} a stage styled by a given stylesheet is set by. */
export interface FootageLayerClockFactory {
  /** A clock for one stage styled by `style`, with nothing learnt yet. */
  open(style: FootageStyle): FootageLayerClock;
}
