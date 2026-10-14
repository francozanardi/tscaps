import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import type { SpriteSheetSizeProbe } from '@modules/rendering/subtitle/SpriteSheetSizeProbe';
import type { SubtitleFrameRenderer } from '@modules/rendering/SubtitleFrameRenderer';
import { BrowserSubtitleFrameRenderer } from '@modules/rendering/BrowserSubtitleFrameRenderer';
import { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import { BatchedSubtitleLayerSource } from '@modules/video/mediabunny/caption/BatchedSubtitleLayerSource';
import { VideoBoundSubtitleLayerSource } from '@modules/video/mediabunny/caption/VideoBoundSubtitleLayerSource';
import { ComposedSubtitleLayerSource } from '@modules/video/mediabunny/caption/ComposedSubtitleLayerSource';

/**
 * The default caption source per layer: styles that read the video
 * frame are painted frame by frame, the rest in batches, each half by a
 * browser renderer of its own painting only that layer.
 *
 * `baseRenderer` stands in for both halves of the base layer when
 * given, and is shared by them. It knows no layers and paints every
 * subtree, so it is only ever used there; the other layers always take
 * a renderer of their own.
 */
export class BrowserSubtitleLayerSourceFactory implements SubtitleLayerSourceFactory {

  constructor(
    private readonly cssResourceEmbedder: CssResourceEmbedder,
    private readonly wordSplitter: WordSplitter,
    private readonly sizeProbe: SpriteSheetSizeProbe,
    private readonly baseRenderer: SubtitleFrameRenderer | null = null,
  ) {}

  create(layer: CaptionLayer, framesHaveAlpha: boolean): SubtitleLayerSource {
    return new ComposedSubtitleLayerSource(
      new BatchedSubtitleLayerSource(this.rendererFor(layer)),
      new VideoBoundSubtitleLayerSource(this.rendererFor(layer), framesHaveAlpha),
      new SubtitleStyleFrameDemand(),
    );
  }

  // Each half gets its own renderer: the two hold independent open()
  // state that would clash on a shared instance.
  private rendererFor(layer: CaptionLayer): SubtitleFrameRenderer {
    if (this.baseRenderer !== null && layer === CaptionLayer.BASE) return this.baseRenderer;
    return BrowserSubtitleFrameRenderer.create(this.cssResourceEmbedder, this.wordSplitter, { sizeProbe: this.sizeProbe, layer });
  }
}
