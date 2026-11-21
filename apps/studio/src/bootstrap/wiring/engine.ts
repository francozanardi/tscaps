import {
  StructureTagger,
  PauseTagger,
  CaptionStacking,
  CaptionBlendMode,
  AnyOriginCssResourceUrlPolicy,
  BrowserCssResourceEmbedder,
  type CssResourceEmbedder,
  MediaBunnyAudioDecoder,
  WebAudioAudioDecoder,
  FallbackAudioDecoder,
  GraphemeWordSplitter,
  DocumentEditor,
  MediaBunnyRenderers,
  SvgFilterDefinitionsParser,
  TagConditionParser,
  CssClass,
  CssVariable,
} from '@tscaps/engine';
import {
  type VideoFrameDecoderFactory,
  BaselineCssComposer,
  GlyphInkReader,
  LayoutWidthReader,
} from '@tscaps/engine/advanced';
import type { ErrorsModule } from '@bootstrap/wiring/errors';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import { VideoEncoderProbeReporter } from '@core/export/services/VideoEncoderProbeReporter';
import { SpriteSheetProbeReporter } from '@core/export/services/SpriteSheetProbeReporter';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';

export type EngineModule = ReturnType<typeof bootEngine>;

/**
 * Boots the engine surface the editor consumes: the engine's renderers
 * (`MediaBunnyRenderers`, reporting its encoder and sprite-sheet probes
 * to telemetry) and the parts they share with the editor, the structure tagger, the grapheme word splitter, and
 * the CSS resource embedder. Includes the three web-app registries
 * (segment splitters, line splitters, effects) that the engine
 * pipeline reads when rendering — they are engine-adjacent platform
 * plumbing and ride along with the engine module.
 *
 * Also exposes `stillFrameRenderer`, which paints single output frames
 * of a render job through the same compositing as `renderer`, in any
 * order.
 *
 * Also exposes `transcodeCoordinator` (the shared mediabunny
 * decode→paint→encode primitive), used both by the export renderer
 * and by any other consumer that needs to run a mediabunny transcode
 * with a custom painter (e.g. the preview proxy generator).
 *
 * Also exposes `documentEditor` (the stateless engine editor for
 * structural document edits), `constants` (the engine's public
 * runtime constants the ui needs to apply directly in JSX),
 * `audioDecoder` (the browser-side implementation of the engine's
 * AudioDecoder port, shared by every consumer that needs PCM from a
 * media file), `layoutWidthReader` (how wide a caption element is
 * laid out, read the way the export reads it) and `glyphInkReader` (how
 * far a caption line's glyphs reach from its baseline, read the same
 * way). All of them are here so
 * ui can consume them through `useEngine()` instead of value-importing
 * from `@tscaps/engine` — keeping the package opaque to the React
 * layer.
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
  const tagConditionParser = new TagConditionParser();
  const segmentSplitters = new SegmentSplitterRegistry(tagConditionParser);
  const lineSplitters = new LineSplitterRegistry(tagConditionParser);
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
  const renderers = new MediaBunnyRenderers({
    cssResourceEmbedder,
    wordSplitter,
    overrides: {
      ...(deps.videoFrameDecoderFactory !== undefined && { videoFrameDecoderFactory: deps.videoFrameDecoderFactory }),
      videoEncoderProbeObserver: new VideoEncoderProbeReporter(deps.telemetry.telemetry),
      spriteSheetProbeObserver: new SpriteSheetProbeReporter(
        deps.telemetry.telemetry,
        deps.errors.errorReporter,
        deps.errors.errorClassifier,
        deps.errors.errorTelemetryDescriber,
      ),
    },
  });
  return {
    renderer: renderers.videoRenderer,
    stillFrameRenderer: renderers.stillFrameRenderer,
    footageResolvers: renderers.parts.footageResolvers,
    footageStageBaseline: renderers.parts.footageStageBaseline,
    footageGrader: renderers.parts.footageGrader,
    transcodeCoordinator: renderers.parts.transcodeCoordinator,
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
    audioMixCodecs: renderers.parts.audioMixCodecs,
    layoutWidthReader: new LayoutWidthReader(),
    glyphInkReader: new GlyphInkReader(),
    constants: {
      VIDEO_FRAME_LAYER_CLASS: CssClass.VIDEO_FRAME_LAYER,
      // The same baseline the export composes, in the same layer. The
      // preview renders into a document that already carries the
      // universal half, so only the optional blocks come across.
      CAPTION_BASELINE_CSS: new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true, isolation: true }),
      BEHIND_ACTOR_ACTIVE_CLASS: CssClass.BEHIND_ACTOR_ACTIVE,
      BEHIND_ACTOR_PARTIAL_CLASS: CssClass.BEHIND_ACTOR_PARTIAL,
      CAPTION_STACKING_UNDER_TOP_LAYER: CaptionStacking.UNDER_TOP_LAYER,
      CAPTION_STACKING_OVER_TOP_LAYER: CaptionStacking.OVER_TOP_LAYER,
      CAPTION_BLEND_NORMAL: CaptionBlendMode.NORMAL,
      DETACHED_WORD_FRAGMENT_CLASS: CssClass.DETACHED_WORD_FRAGMENT,
      SEGMENT_WIDTH_EM_VARIABLE: CssVariable.SEGMENT_WIDTH_EM,
      LINE_WIDTH_EM_VARIABLE: CssVariable.LINE_WIDTH_EM,
      PREVIOUS_LINE_WIDTH_EM_VARIABLE: CssVariable.PREVIOUS_LINE_WIDTH_EM,
      LINE_INK_ASCENT_EM_VARIABLE: CssVariable.LINE_INK_ASCENT_EM,
      LINE_INK_DESCENT_EM_VARIABLE: CssVariable.LINE_INK_DESCENT_EM,
      WORD_WIDTH_EM_VARIABLE: CssVariable.WORD_WIDTH_EM,
    },
  };
}
