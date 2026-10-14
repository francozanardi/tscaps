import type { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';

/**
 * Builds the caption source for one caption layer. Called once per
 * layer a render paints in, so each layer gets a source of its own with
 * its own open state.
 */
export interface SubtitleLayerSourceFactory {
  /** @param framesHaveAlpha Whether the frames under the captions are transparent, which a caption sampling them keeps. */
  create(layer: CaptionLayer, framesHaveAlpha: boolean): SubtitleLayerSource;
}
