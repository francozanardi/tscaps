import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import type { SpriteSheetSizeProbe } from '@modules/rendering/subtitle/SpriteSheetSizeProbe';
import type { SubtitleFrameRenderer } from '@modules/rendering/SubtitleFrameRenderer';
import { BrowserSubtitleFrameRenderer } from '@modules/rendering/BrowserSubtitleFrameRenderer';
import { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';
import type { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import { RandomAccessSubtitleLayerSource } from '@modules/video/mediabunny/caption/RandomAccessSubtitleLayerSource';
import { VideoBoundSubtitleLayerSource } from '@modules/video/mediabunny/caption/VideoBoundSubtitleLayerSource';

/**
 * A caption source per layer that answers moments in any order
 * ({@link RandomAccessSubtitleLayerSource}), each half painted by a
 * browser renderer of its own painting only that layer.
 *
 * `sizeProbe` decides how many pictures a sheet holds. A source asked
 * for one moment at a time fills one tile per sheet, so a probe whose
 * budget holds a single tile serves it fully and never decodes a
 * raster to find out more.
 */
export class BrowserRandomAccessSubtitleLayerSourceFactory implements SubtitleLayerSourceFactory {

  constructor(
    private readonly cssResourceEmbedder: CssResourceEmbedder,
    private readonly wordSplitter: WordSplitter,
    private readonly sizeProbe: SpriteSheetSizeProbe,
  ) {}

  create(layer: CaptionLayer, framesHaveAlpha: boolean): SubtitleLayerSource {
    return new RandomAccessSubtitleLayerSource(
      this.rendererFor(layer),
      new VideoBoundSubtitleLayerSource(this.rendererFor(layer), framesHaveAlpha),
      new SubtitleStyleFrameDemand(),
    );
  }

  // Each half gets its own renderer: the two hold independent open()
  // state that would clash on a shared instance.
  private rendererFor(layer: CaptionLayer): SubtitleFrameRenderer {
    return BrowserSubtitleFrameRenderer.create(this.cssResourceEmbedder, this.wordSplitter, { sizeProbe: this.sizeProbe, layer });
  }
}
