import {
  MediaBunnyVideoRenderer,
  BrowserSubtitleFrameRenderer,
  BrowserOverlayFrameRenderer,
  StructureTagger,
  PauseTagger,
  DefaultCodecPolicy,
  DefaultVideoFrameDecoderFactory,
  DefaultAudioTrackBridgeFactory,
  MediaBunnyOutputTargetBuilder,
  MediaBunnyCanvasVideoTrackEncoderFactory,
  LayeredFrameCompositor,
  BatchedSubtitleLayerSource,
  VideoBoundSubtitleLayerSource,
  ComposedSubtitleLayerSource,
  BrowserCssResourceEmbedder,
  BrowserAudioDecoder,
  GraphemeWordSplitter,
  DocumentEditor,
  SvgFilterDefinitionsParser,
  VIDEO_FRAME_LAYER_CLASS,
  VIDEO_FRAME_LAYER_BASELINE_CSS,
  DECORATION_CONTAINER_BASELINE_CSS,
} from '@tscaps/engine';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';

export type EngineModule = ReturnType<typeof bootEngine>;

/**
 * Boots the engine surface the editor consumes: the renderer
 * pipeline (codec policy, frame decoders, encoders, audio bridges,
 * output target builder, compositor, subtitle and overlay layer
 * renderers), the structure tagger, the grapheme word splitter, and
 * the CSS resource embedder. Includes the three web-app registries
 * (segment splitters, line splitters, effects) that the engine
 * pipeline reads when rendering — they are engine-adjacent platform
 * plumbing and ride along with the engine module.
 *
 * Also exposes `documentEditor` (the stateless engine editor for
 * structural document edits), `constants` (the engine's public
 * runtime constants the ui needs to apply directly in JSX), and
 * `audioDecoder` (the browser-side implementation of the engine's
 * AudioDecoder port, shared by every consumer that needs PCM from a
 * media file). All three are here so ui can consume them through
 * `useEngine()` instead of value-importing from `@tscaps/engine` —
 * keeping the package opaque to the React layer.
 */
export function bootEngine() {
  const segmentSplitters = new SegmentSplitterRegistry();
  const lineSplitters = new LineSplitterRegistry();
  const effects = new EffectRegistry();
  const wordSplitter = new GraphemeWordSplitter();
  const structureTagger = new StructureTagger();
  const pauseTagger = new PauseTagger({ minGapSeconds: 1 });
  const cssResourceEmbedder = new BrowserCssResourceEmbedder();
  const documentEditor = new DocumentEditor();
  const svgFilterDefinitionsParser = new SvgFilterDefinitionsParser();
  const audioDecoder = new BrowserAudioDecoder();
  const renderer = new MediaBunnyVideoRenderer({
    subtitleLayer: new ComposedSubtitleLayerSource(
      new BatchedSubtitleLayerSource(
        BrowserSubtitleFrameRenderer.create(cssResourceEmbedder, wordSplitter),
      ),
      new VideoBoundSubtitleLayerSource(
        BrowserSubtitleFrameRenderer.create(cssResourceEmbedder, wordSplitter),
      ),
    ),
    overlayRenderer: new BrowserOverlayFrameRenderer(),
    codecPolicy: new DefaultCodecPolicy(),
    videoFrameDecoderFactory: new DefaultVideoFrameDecoderFactory(),
    videoTrackEncoderFactory: new MediaBunnyCanvasVideoTrackEncoderFactory(),
    audioTrackBridgeFactory: new DefaultAudioTrackBridgeFactory(),
    outputTargetBuilder: new MediaBunnyOutputTargetBuilder(),
    frameCompositor: new LayeredFrameCompositor(),
  });
  return {
    renderer,
    structureTagger,
    pauseTagger,
    wordSplitter,
    cssResourceEmbedder,
    documentEditor,
    svgFilterDefinitionsParser,
    segmentSplitters,
    lineSplitters,
    effects,
    audioDecoder,
    constants: {
      VIDEO_FRAME_LAYER_CLASS,
      VIDEO_FRAME_LAYER_BASELINE_CSS,
      DECORATION_CONTAINER_BASELINE_CSS,
    },
  };
}
