import {
  MediaBunnyVideoRenderer,
  MediaBunnyTranscodeCoordinator,
  CaptionsOverlayFramePainterFactory,
  BrowserSubtitleFrameRenderer,
  BrowserOverlayFrameRenderer,
  StructureTagger,
  PauseTagger,
  DefaultCodecPolicy,
  DefaultVideoFrameDecoderFactory,
  type VideoFrameDecoderFactory,
  DefaultAudioTrackBridgeFactory,
  MediaBunnyOutputTargetBuilder,
  MediaBunnyCanvasVideoTrackEncoderFactory,
  LayeredFrameCompositor,
  BatchedSubtitleLayerSource,
  VideoBoundSubtitleLayerSource,
  ComposedSubtitleLayerSource,
  AnyOriginCssResourceUrlPolicy,
  BrowserCssResourceEmbedder,
  type CssResourceEmbedder,
  MediaBunnyAudioDecoder,
  WebAudioAudioDecoder,
  FallbackAudioDecoder,
  GraphemeWordSplitter,
  DocumentEditor,
  SvgFilterDefinitionsParser,
  BaselineCssComposer,
  CssClass,
  CssVariable,
  SpriteSheetSizeProbe,
  ImageDecodeSpriteSheetRasterProbe,
} from '@tscaps/engine';
import type { ErrorsModule } from '@bootstrap/wiring/errors';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import { SpriteSheetProbeReporter } from '@core/export/services/SpriteSheetProbeReporter';
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
 * Also exposes `transcodeCoordinator` (the shared mediabunny
 * decode→paint→encode primitive), used both by the export renderer
 * and by any other consumer that needs to run a mediabunny transcode
 * with a custom painter (e.g. the preview proxy generator).
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
export interface EngineDependencies {
  readonly telemetry: TelemetryModule;
  readonly errors: ErrorsModule;
  /**
   * Which decoders a render may drive the input through. Defaults to
   * the one that falls back to a `<video>` element for codecs WebCodecs
   * cannot decode; a host with a cheaper way to handle those than
   * driving playback supplies its own.
   */
  readonly videoFrameDecoderFactory?: VideoFrameDecoderFactory;
  /**
   * How stylesheet resources are inlined before rasterization.
   * Defaults to fetching whatever a stylesheet names, which is right
   * in a person's own browser; a host rendering stylesheets written by
   * other people supplies one that does not leave the machine.
   */
  readonly cssResourceEmbedder?: CssResourceEmbedder;
}

export function bootEngine(deps: EngineDependencies) {
  const segmentSplitters = new SegmentSplitterRegistry();
  const lineSplitters = new LineSplitterRegistry();
  const effects = new EffectRegistry();
  const wordSplitter = new GraphemeWordSplitter();
  const structureTagger = new StructureTagger();
  const pauseTagger = new PauseTagger({ minGapSeconds: 1 });
  const cssResourceEmbedder = deps.cssResourceEmbedder
    ?? new BrowserCssResourceEmbedder(new AnyOriginCssResourceUrlPolicy());
  const documentEditor = new DocumentEditor();
  const svgFilterDefinitionsParser = new SvgFilterDefinitionsParser();
  // WebCodecs first; the Web Audio path covers browsers whose
  // WebCodecs has no AudioDecoder (Safari before 26 is video-only).
  const audioDecoder = new FallbackAudioDecoder(new MediaBunnyAudioDecoder(), new WebAudioAudioDecoder());
  const transcodeCoordinator = new MediaBunnyTranscodeCoordinator({
    videoFrameDecoderFactory: deps.videoFrameDecoderFactory ?? new DefaultVideoFrameDecoderFactory(),
    videoTrackEncoderFactory: new MediaBunnyCanvasVideoTrackEncoderFactory(),
    audioTrackBridgeFactory: new DefaultAudioTrackBridgeFactory(),
    outputTargetBuilder: new MediaBunnyOutputTargetBuilder(),
  });
  // Shared by both renderers: a walk decodes rasters up to the whole
  // pixel budget, and the two work at the same output size.
  const sizeProbe = new SpriteSheetSizeProbe(
    new ImageDecodeSpriteSheetRasterProbe(),
    new SpriteSheetProbeReporter(
      deps.telemetry.telemetry,
      deps.errors.errorReporter,
      deps.errors.errorClassifier,
      deps.errors.errorTelemetryDescriber,
    ),
  );
  const captionsOverlayPainterFactory = new CaptionsOverlayFramePainterFactory(
    new ComposedSubtitleLayerSource(
      new BatchedSubtitleLayerSource(
        BrowserSubtitleFrameRenderer.create(cssResourceEmbedder, wordSplitter, { sizeProbe }),
      ),
      new VideoBoundSubtitleLayerSource(
        BrowserSubtitleFrameRenderer.create(cssResourceEmbedder, wordSplitter, { sizeProbe }),
      ),
    ),
    new BrowserOverlayFrameRenderer(),
    new LayeredFrameCompositor(),
  );
  const renderer = new MediaBunnyVideoRenderer({
    coordinator: transcodeCoordinator,
    codecPolicy: new DefaultCodecPolicy(),
    painterFactory: captionsOverlayPainterFactory,
  });
  return {
    renderer,
    transcodeCoordinator,
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
      VIDEO_FRAME_LAYER_CLASS: CssClass.VIDEO_FRAME_LAYER,
      // The same baseline the export composes, in the same layer. The
      // preview renders into a document that already carries the
      // universal half, so only the optional blocks come across.
      CAPTION_BASELINE_CSS: new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true }),
      BEHIND_ACTOR_ACTIVE_CLASS: CssClass.BEHIND_ACTOR_ACTIVE,
      SEGMENT_WIDTH_EM_VARIABLE: CssVariable.SEGMENT_WIDTH_EM,
      LINE_WIDTH_EM_VARIABLE: CssVariable.LINE_WIDTH_EM,
      WORD_WIDTH_EM_VARIABLE: CssVariable.WORD_WIDTH_EM,
    },
  };
}
