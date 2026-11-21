import { AnyOriginCssResourceUrlPolicy } from '@modules/css/AnyOriginCssResourceUrlPolicy';
import { BrowserCssResourceEmbedder } from '@modules/css/BrowserCssResourceEmbedder';
import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import { BrowserOverlayFrameRenderer } from '@modules/rendering/BrowserOverlayFrameRenderer';
import { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';
import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import { ImageDecodeSpriteSheetRasterProbe } from '@modules/rendering/subtitle/ImageDecodeSpriteSheetRasterProbe';
import { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { SpriteSheetSizeProbe } from '@modules/rendering/subtitle/SpriteSheetSizeProbe';
import { WebAudioAudioTrackSampleDecoder } from '@modules/audio-decoding/WebAudioAudioTrackSampleDecoder';
import { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { CanvasFootageCompositor } from '@modules/video/CanvasFootageCompositor';
import type { FootageCompositor } from '@modules/video/FootageCompositor';
import type { StillFrameRenderer } from '@modules/video/StillFrameRenderer';
import type { VideoRenderer } from '@modules/video/VideoRenderer';
import type { AnimatedImageOpener } from '@modules/video/animation/AnimatedImageOpener';
import { FallbackAnimatedImageOpener } from '@modules/video/animation/FallbackAnimatedImageOpener';
import { GifFileReader } from '@modules/video/animation/GifFileReader';
import { GifFrameDurationReader } from '@modules/video/animation/GifFrameDurationReader';
import { GifLzwDecoder } from '@modules/video/animation/GifLzwDecoder';
import { ImageDecoderGifOpener } from '@modules/video/animation/ImageDecoderGifOpener';
import { ScriptGifOpener } from '@modules/video/animation/ScriptGifOpener';
import { CanvasFilterFootageGrader } from '@modules/video/grade/CanvasFilterFootageGrader';
import { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';
import type { FootageGrader } from '@modules/video/grade/FootageGrader';
import { WebGlFootageGrader } from '@modules/video/grade/WebGlFootageGrader';
import { MediaBunnyStillFrameRenderer } from '@modules/video/mediabunny/MediaBunnyStillFrameRenderer';
import { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
import { MediaBunnyVideoRenderer } from '@modules/video/mediabunny/MediaBunnyVideoRenderer';
import type { MediaBunnyRendererOverrides } from '@modules/video/mediabunny/MediaBunnyRendererOverrides';
import type { MediaBunnyRendererParts } from '@modules/video/mediabunny/MediaBunnyRendererParts';
import { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
import { EncodableAudioMixCodecSelector } from '@modules/video/mediabunny/audio/EncodableAudioMixCodecSelector';
import { FallbackAudioLayerDecoder } from '@modules/video/mediabunny/audio/FallbackAudioLayerDecoder';
import { MediaBunnyAudioLayerDecoder } from '@modules/video/mediabunny/audio/MediaBunnyAudioLayerDecoder';
import { WebAudioAudioLayerDecoder } from '@modules/video/mediabunny/audio/WebAudioAudioLayerDecoder';
import { BrowserRandomAccessSubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/BrowserRandomAccessSubtitleLayerSourceFactory';
import { BrowserSubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/BrowserSubtitleLayerSourceFactory';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
import { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
import { ProbingVideoEncoderAccelerationPolicy } from '@modules/video/mediabunny/encoder/ProbingVideoEncoderAccelerationPolicy';
import { MediaBunnyFootageOpener } from '@modules/video/mediabunny/footage/MediaBunnyFootageOpener';
import { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
import { LayeredFrameCompositor } from '@modules/video/mediabunny/frame/LayeredFrameCompositor';
import { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
import { RenderJobFramePainterFactory } from '@modules/video/mediabunny/painter/RenderJobFramePainterFactory';
import { ComputedFootageLayerStateReader } from '@modules/video/stage/ComputedFootageLayerStateReader';
import { CssFootageClockUseInspector } from '@modules/video/stage/CssFootageClockUseInspector';
import { CssFootageLayerClockFactory } from '@modules/video/stage/CssFootageLayerClockFactory';
import { CssFootageLayerResolverFactory } from '@modules/video/stage/CssFootageLayerResolverFactory';
import { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';

/** How `MediaBunnyRenderers` is put together. Everything left out is the engine's own. */
export interface MediaBunnyRenderersOptions {
  /**
   * How resources a stylesheet names (fonts, images) are inlined before
   * captions are rasterized. Defaults to fetching whatever a stylesheet
   * names, which suits a caller rendering stylesheets it trusts; one
   * rendering stylesheets other people wrote supplies one whose policy
   * keeps requests where it wants them.
   */
  readonly cssResourceEmbedder?: CssResourceEmbedder;
  /** How a word is split into letters, where a style paints letters apart. Defaults to graphemes. */
  readonly wordSplitter?: WordSplitter;
  /** Parts replaced or watched; `@tscaps/engine/advanced` names what they are. */
  readonly overrides?: MediaBunnyRendererOverrides;
}

/**
 * The engine's renderers, ready to use: a `VideoRenderer` that writes a
 * job to a video file and a `StillFrameRenderer` that paints any of its
 * frames, both through MediaBunny, WebCodecs and the browser's own
 * rendering of the captions' HTML. The two paint a job through the same
 * compositing, so a still frame is the frame the render writes at the
 * same moment.
 *
 * Building one is cheap and touches no browser API; each render or still
 * session opens what it needs and lets it go when it ends. One instance
 * serves any number of jobs, one after another or at once.
 */
export class MediaBunnyRenderers {
  readonly videoRenderer: VideoRenderer;
  readonly stillFrameRenderer: StillFrameRenderer;
  /** What these renderers are built from, for a caller sharing them. */
  readonly parts: MediaBunnyRendererParts;
  // Shared by both renderers; all stateless.
  private readonly captionLayerDemand = new CaptionLayerDemand(new SegmentSubtreeDecomposer());
  private readonly frameCompositor = new LayeredFrameCompositor();
  private readonly footageOpener = new MediaBunnyFootageOpener(this.buildGifOpener());

  constructor(options: MediaBunnyRenderersOptions = {}) {
    const overrides = options.overrides ?? {};
    const cssResourceEmbedder = options.cssResourceEmbedder
      ?? new BrowserCssResourceEmbedder(new AnyOriginCssResourceUrlPolicy());
    const wordSplitter = options.wordSplitter ?? new GraphemeWordSplitter();
    const audioMixCodecs = new EncodableAudioMixCodecSelector();
    const footageStageBaseline = new FootageStageBaselineCss();
    this.parts = {
      transcodeCoordinator: this.buildTranscodeCoordinator(overrides, audioMixCodecs),
      audioMixCodecs,
      footageResolvers: this.buildFootageResolvers(footageStageBaseline),
      footageStageBaseline,
      footageGrader: this.buildFootageGrader(),
    };
    const footageCompositor = new CanvasFootageCompositor(this.parts.footageGrader);
    const overlayRenderer = overrides.overlayFrameRenderer ?? new BrowserOverlayFrameRenderer();
    const exportSizeProbe = new SpriteSheetSizeProbe(
      new ImageDecodeSpriteSheetRasterProbe(),
      overrides.spriteSheetProbeObserver ?? null,
    );
    this.videoRenderer = new MediaBunnyVideoRenderer({
      coordinator: this.parts.transcodeCoordinator,
      codecPolicy: new DefaultCodecPolicy(),
      painterFactory: this.buildPainterFactory(
        // A caller's caption renderer knows no layers and paints every
        // subtree, so it only ever stands in for the base layer.
        new BrowserSubtitleLayerSourceFactory(cssResourceEmbedder, wordSplitter, exportSizeProbe, overrides.subtitleFrameRenderer ?? null),
        overlayRenderer,
        footageCompositor,
      ),
    });
    // A still asks its captions for one moment at a time, which one tile
    // per sheet serves whole: a budget of no pixels settles on that tile
    // without decoding a single raster to look for more.
    const stillSizeProbe = new SpriteSheetSizeProbe(new ImageDecodeSpriteSheetRasterProbe(), null, 0);
    this.stillFrameRenderer = new MediaBunnyStillFrameRenderer({
      painterFactory: this.buildPainterFactory(
        new BrowserRandomAccessSubtitleLayerSourceFactory(cssResourceEmbedder, wordSplitter, stillSizeProbe),
        overlayRenderer,
        footageCompositor,
      ),
    });
  }

  private buildTranscodeCoordinator(
    overrides: MediaBunnyRendererOverrides,
    audioMixCodecs: EncodableAudioMixCodecSelector,
  ): MediaBunnyTranscodeCoordinator {
    return new MediaBunnyTranscodeCoordinator({
      videoFrameDecoderFactory: overrides.videoFrameDecoderFactory ?? new DefaultVideoFrameDecoderFactory(),
      videoTrackEncoderFactory: new MediaBunnyCanvasVideoTrackEncoderFactory(),
      videoEncoderAccelerationPolicy: new ProbingVideoEncoderAccelerationPolicy(overrides.videoEncoderProbeObserver ?? null),
      // Per file, mediabunny first: Safari decodes FLAC only through Web
      // Audio. The input's own audio gets the same second path, in
      // segments, for browsers whose WebCodecs fails on a codec it claims.
      audioTrackBridgeFactory: new DefaultAudioTrackBridgeFactory(
        new FallbackAudioLayerDecoder(new MediaBunnyAudioLayerDecoder(), new WebAudioAudioLayerDecoder()),
        audioMixCodecs,
        new WebAudioAudioTrackSampleDecoder(),
      ),
      outputTargetBuilder: new MediaBunnyOutputTargetBuilder(),
    });
  }

  private buildFootageResolvers(footageStageBaseline: FootageStageBaselineCss): CssFootageLayerResolverFactory {
    return new CssFootageLayerResolverFactory(
      new ComputedFootageLayerStateReader(),
      footageStageBaseline,
      new CssFootageLayerClockFactory(new CssFootageClockUseInspector()),
    );
  }

  private buildPainterFactory(
    captionSources: SubtitleLayerSourceFactory,
    overlayRenderer: OverlayFrameRenderer,
    footageCompositor: FootageCompositor,
  ): RenderJobFramePainterFactory {
    return new RenderJobFramePainterFactory(
      captionSources,
      this.captionLayerDemand,
      overlayRenderer,
      this.frameCompositor,
      this.footageOpener,
      footageCompositor,
      this.parts.footageResolvers,
    );
  }

  /** GIFs through the browser's own decoder where it has one that can read them, through the script decoder otherwise. */
  private buildGifOpener(): AnimatedImageOpener {
    const files = new GifFileReader();
    const durations = new GifFrameDurationReader(files);
    return new FallbackAnimatedImageOpener([
      new ImageDecoderGifOpener(durations),
      new ScriptGifOpener(files, durations, new GifLzwDecoder()),
    ]);
  }

  /** Grades on the GPU, and on a plain canvas where WebGL2 cannot be had. */
  private buildFootageGrader(): FootageGrader {
    const math = new FootageGradeMath();
    return new WebGlFootageGrader(math, new CanvasFilterFootageGrader(math));
  }
}
