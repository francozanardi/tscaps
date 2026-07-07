import type { Transcriber, TranscriberOptions } from '@modules/transcription/Transcriber';
import { WhisperTranscriber } from '@modules/transcription/WhisperTranscriber';
import { BrowserAudioDecoder } from '@modules/transcription/BrowserAudioDecoder';
import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { LineSplitter } from '@modules/splitting/LineSplitter';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
import { CompositeSegmentSplitter } from '@modules/splitting/CompositeSegmentSplitter';
import { BoundarySegmentSplitter } from '@modules/splitting/BoundarySegmentSplitter';
import { LimitByScaledCharsSegmentSplitter } from '@modules/splitting/LimitByScaledCharsSegmentSplitter';
import type { Tagger } from '@modules/tagging/Tagger';
import { StructureTagger } from '@modules/tagging/StructureTagger';
import type { Effect } from '@modules/effect/Effect';
import type { SubtitleFrameRenderer, SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import { BrowserSubtitleFrameRenderer } from '@modules/rendering/BrowserSubtitleFrameRenderer';
import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import { BrowserOverlayFrameRenderer } from '@modules/rendering/BrowserOverlayFrameRenderer';
import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { RenderingConfig } from '@modules/rendering/types/RenderingConfig';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import { BrowserCssResourceEmbedder } from '@modules/css/BrowserCssResourceEmbedder';
import type { VideoRenderer } from '@modules/video/VideoRenderer';
import type {
  OutputFormat,
  RenderQuality,
  RenderOutputChunk,
  AudioDiscardReason,
  FallbackDecoderInfo,
} from '@modules/video/RenderJob';
import { MediaBunnyVideoRenderer } from '@modules/video/mediabunny/MediaBunnyVideoRenderer';
import { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
import { CaptionsOverlayFramePainterFactory } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainterFactory';
import { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
import { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
import { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
import { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
import { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
import { LayeredFrameCompositor } from '@modules/video/mediabunny/frame/LayeredFrameCompositor';
import { BatchedSubtitleLayerSource } from '@modules/video/mediabunny/caption/BatchedSubtitleLayerSource';
import { VideoBoundSubtitleLayerSource } from '@modules/video/mediabunny/caption/VideoBoundSubtitleLayerSource';
import { ComposedSubtitleLayerSource } from '@modules/video/mediabunny/caption/ComposedSubtitleLayerSource';
import { RenderPipeline } from '@modules/pipeline/RenderPipeline';
import type { OutputResolution, RenderPipelineConfig } from '@modules/pipeline/RenderPipeline';

/**
 * Knobs that drive the default segment splitter — a composite that
 * first cuts on hard sentence boundaries and then enforces a
 * weighted character budget per segment. Honoured only when no
 * explicit `SegmentSplitter` is supplied.
 */
export interface DefaultSegmentSplitterConfig {
  separators: ReadonlyArray<string>;
  maxChars: number;
  minChars: number;
  scale: number;
}

/**
 * Knobs that drive the default line splitter — pixel-balanced over a
 * DOM-probed text measurer. `maxWidthRatio` is multiplied by the
 * resolved output width to derive the absolute pixel budget per line.
 * Honoured only when no explicit `LineSplitter` is supplied.
 */
export interface DefaultLineSplitterConfig {
  maxLines: number;
  minLines: number;
  maxWidthRatio: number;
}

const DEFAULT_SEGMENT_SPLITTER_CONFIG: DefaultSegmentSplitterConfig = {
  separators: ['.', '?', '!'],
  maxChars: 40,
  minChars: 10,
  scale: 1,
};

const DEFAULT_LINE_SPLITTER_CONFIG: DefaultLineSplitterConfig = {
  maxLines: 2,
  minLines: 1,
  maxWidthRatio: 0.8,
};

const DEFAULT_ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom',
  verticalOffset: 0.85,
  horizontalAlign: 'center',
  horizontalOffset: 0.5,
};

const DEFAULT_RENDERING: RenderingConfig = {
  splitWordsIntoLetters: false,
  videoFrame: { required: false, jpegQuality: 1 },
  padding: null,
};

const DEFAULT_SUBTITLE_CSS = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 700;
    font-size: 5cqh;
    color: #ffffff;
    text-align: center;
    line-height: 1.2;
    text-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.7);
  }
  .line { display: block; }
  .word { display: inline-block; margin: 0 0.15em; }
`;

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  css: DEFAULT_SUBTITLE_CSS,
  inlineStyles: {},
  alignment: DEFAULT_ALIGNMENT,
  rendering: DEFAULT_RENDERING,
};

/**
 * Fluent assembler that produces a {@link RenderPipeline} preloaded with
 * sensible defaults for every stage of the render flow: an in-browser
 * Whisper transcriber, a sentence + scaled-char segment splitter, a
 * pixel-balanced line splitter (built lazily once output size is known),
 * the structural tagger, no semantic taggers, no effects, and a
 * MediaBunny-backed video renderer.
 *
 * Every `with*` method narrows one slot and leaves the rest at their
 * defaults; defaults stay in place until explicitly replaced. The only
 * required input is the source video — `build` throws otherwise.
 *
 * Two granularities for styling: single-style callers shape the default
 * via `withCss`/`withAlignment`/`withRenderingConfig`/`withInlineStyles`
 * (or replace it wholesale with `withSubtitleStyle`); multi-kind callers
 * pass a full per-kind map through `withSubtitleStyles`. The default
 * line splitter only fits the single-style path — `withSubtitleStyles`
 * disables it unless the caller also supplies their own splitter.
 *
 * Tweaking the default splitters' parameters without rebuilding them
 * goes through the symmetric `withDefaultSegmentSplitterConfig` /
 * `withDefaultLineSplitterConfig`.
 */
export class RenderPipelineBuilder {
  private video: File | Blob | null = null;

  private transcriber: Transcriber | null = null;
  private transcriberOptions: TranscriberOptions | undefined = undefined;

  private segmentSplitter: SegmentSplitter | null = null;
  private defaultSegmentSplitterConfig: DefaultSegmentSplitterConfig = { ...DEFAULT_SEGMENT_SPLITTER_CONFIG };

  private lineSplitter: LineSplitter | null = null;
  private defaultLineSplitterConfig: DefaultLineSplitterConfig = { ...DEFAULT_LINE_SPLITTER_CONFIG };

  private wordSplitter: WordSplitter | null = null;

  private semanticTaggers: Tagger[] = [];
  private effects: Effect[] = [];

  private style: SubtitleStyle = DEFAULT_SUBTITLE_STYLE;
  private explicitStyles: Readonly<Record<string, SubtitleStyle>> | null = null;

  private outputFormat: OutputFormat | undefined = undefined;
  private quality: RenderQuality | undefined = undefined;
  private outputResolution: OutputResolution | undefined = undefined;
  private outputStream: WritableStream<RenderOutputChunk> | undefined = undefined;
  private overlayHtml: string | undefined = undefined;
  private onAudioDiscarded: ((reason: AudioDiscardReason) => void) | undefined = undefined;
  private confirmFallbackDecoder: ((info: FallbackDecoderInfo) => Promise<boolean>) | undefined = undefined;

  private videoRenderer: VideoRenderer | null = null;
  private subtitleFrameRenderer: SubtitleFrameRenderer | null = null;
  private overlayFrameRenderer: OverlayFrameRenderer | null = null;
  private cssResourceEmbedder: CssResourceEmbedder | null = null;

  withInputVideo(video: File | Blob): this {
    this.video = video;
    return this;
  }

  withTranscriber(transcriber: Transcriber): this {
    this.transcriber = transcriber;
    return this;
  }

  withTranscriberOptions(options: TranscriberOptions): this {
    this.transcriberOptions = options;
    return this;
  }

  withSegmentSplitter(splitter: SegmentSplitter): this {
    this.segmentSplitter = splitter;
    return this;
  }

  withDefaultSegmentSplitterConfig(partial: Partial<DefaultSegmentSplitterConfig>): this {
    this.defaultSegmentSplitterConfig = { ...this.defaultSegmentSplitterConfig, ...partial };
    return this;
  }

  withLineSplitter(splitter: LineSplitter): this {
    this.lineSplitter = splitter;
    return this;
  }

  withDefaultLineSplitterConfig(partial: Partial<DefaultLineSplitterConfig>): this {
    this.defaultLineSplitterConfig = { ...this.defaultLineSplitterConfig, ...partial };
    return this;
  }

  withWordSplitter(splitter: WordSplitter): this {
    this.wordSplitter = splitter;
    return this;
  }

  addTagger(tagger: Tagger): this {
    this.semanticTaggers.push(tagger);
    return this;
  }

  withTaggers(taggers: ReadonlyArray<Tagger>): this {
    this.semanticTaggers = [...taggers];
    return this;
  }

  addEffect(effect: Effect): this {
    this.effects.push(effect);
    return this;
  }

  withEffects(effects: ReadonlyArray<Effect>): this {
    this.effects = [...effects];
    return this;
  }

  withCss(css: string): this {
    this.style = { ...this.style, css };
    return this;
  }

  withAlignment(alignment: AlignmentConfig): this {
    this.style = { ...this.style, alignment };
    return this;
  }

  withRenderingConfig(rendering: RenderingConfig): this {
    this.style = { ...this.style, rendering };
    return this;
  }

  withInlineStyles(inlineStyles: InlineStyleMap): this {
    this.style = { ...this.style, inlineStyles };
    return this;
  }

  /** Replaces the single-style default wholesale; subsequent style atajos layer on top of this. */
  withSubtitleStyle(style: SubtitleStyle): this {
    this.style = style;
    return this;
  }

  /**
   * Switches to the multi-kind mode: the supplied map is passed to the
   * video renderer as-is, the single-style default is no longer used,
   * and the default line splitter is disabled (callers in this mode
   * must supply their own via `withLineSplitter` if they want one).
   */
  withSubtitleStyles(styles: Readonly<Record<string, SubtitleStyle>>): this {
    this.explicitStyles = styles;
    return this;
  }

  withOutputFormat(format: OutputFormat): this {
    this.outputFormat = format;
    return this;
  }

  withOutputResolution(width: number, height: number): this {
    this.outputResolution = { width, height };
    return this;
  }

  withQuality(quality: RenderQuality): this {
    this.quality = quality;
    return this;
  }

  withOutputStream(stream: WritableStream<RenderOutputChunk>): this {
    this.outputStream = stream;
    return this;
  }

  withOverlayHtml(html: string): this {
    this.overlayHtml = html;
    return this;
  }

  withOnAudioDiscarded(callback: (reason: AudioDiscardReason) => void): this {
    this.onAudioDiscarded = callback;
    return this;
  }

  withConfirmFallbackDecoder(callback: (info: FallbackDecoderInfo) => Promise<boolean>): this {
    this.confirmFallbackDecoder = callback;
    return this;
  }

  withVideoRenderer(renderer: VideoRenderer): this {
    this.videoRenderer = renderer;
    return this;
  }

  /**
   * Feeds the default MediaBunny video renderer. Ignored if a full
   * `VideoRenderer` was supplied via `withVideoRenderer`.
   */
  withSubtitleFrameRenderer(renderer: SubtitleFrameRenderer): this {
    this.subtitleFrameRenderer = renderer;
    return this;
  }

  /**
   * Feeds the default MediaBunny video renderer. Ignored if a full
   * `VideoRenderer` was supplied via `withVideoRenderer`.
   */
  withOverlayFrameRenderer(renderer: OverlayFrameRenderer): this {
    this.overlayFrameRenderer = renderer;
    return this;
  }

  /**
   * Feeds the default subtitle frame renderer. Ignored if a full
   * `SubtitleFrameRenderer` or `VideoRenderer` was supplied.
   */
  withCssResourceEmbedder(embedder: CssResourceEmbedder): this {
    this.cssResourceEmbedder = embedder;
    return this;
  }

  /** Materialises the pipeline. Throws if no input video has been supplied. */
  build(): RenderPipeline {
    if (this.video === null) {
      throw new Error('RenderPipelineBuilder: input video is required (call withInputVideo)');
    }
    return new RenderPipeline(this.buildConfig(this.video));
  }

  private buildConfig(video: File | Blob): RenderPipelineConfig {
    const wordSplitter = this.wordSplitter ?? new GraphemeWordSplitter();
    const cssResourceEmbedder = this.cssResourceEmbedder ?? new BrowserCssResourceEmbedder();
    const videoRenderer = this.videoRenderer ?? this.buildDefaultVideoRenderer(cssResourceEmbedder, wordSplitter);
    return {
      video,
      transcriber: this.transcriber ?? this.buildDefaultTranscriber(),
      transcriberOptions: this.transcriberOptions,
      segmentSplitter: this.segmentSplitter ?? this.buildDefaultSegmentSplitter(),
      lineSplitter: this.lineSplitter,
      defaultLineSplitterConfig: this.defaultLineSplitterConfig,
      structureTagger: new StructureTagger(),
      semanticTaggers: [...this.semanticTaggers],
      effects: [...this.effects],
      defaultStyle: this.style,
      explicitStyles: this.explicitStyles,
      videoRenderer,
      outputFormat: this.outputFormat,
      quality: this.quality,
      outputResolution: this.outputResolution,
      outputStream: this.outputStream,
      overlayHtml: this.overlayHtml,
      onAudioDiscarded: this.onAudioDiscarded,
      confirmFallbackDecoder: this.confirmFallbackDecoder,
    };
  }

  private buildDefaultTranscriber(): Transcriber {
    return new WhisperTranscriber(new BrowserAudioDecoder());
  }

  private buildDefaultSegmentSplitter(): SegmentSplitter {
    const config = this.defaultSegmentSplitterConfig;
    return new CompositeSegmentSplitter([
      new BoundarySegmentSplitter({ separators: [...config.separators] }),
      new LimitByScaledCharsSegmentSplitter({
        maxChars: config.maxChars,
        minChars: config.minChars,
        scale: config.scale,
      }),
    ]);
  }

  private buildDefaultVideoRenderer(
    cssResourceEmbedder: CssResourceEmbedder,
    wordSplitter: WordSplitter,
  ): VideoRenderer {
    const coordinator = new MediaBunnyTranscodeCoordinator({
      videoFrameDecoderFactory: new DefaultVideoFrameDecoderFactory(),
      videoTrackEncoderFactory: new MediaBunnyCanvasVideoTrackEncoderFactory(),
      audioTrackBridgeFactory: new DefaultAudioTrackBridgeFactory(),
      outputTargetBuilder: new MediaBunnyOutputTargetBuilder(),
    });
    const painterFactory = new CaptionsOverlayFramePainterFactory(
      this.buildDefaultSubtitleLayerSource(cssResourceEmbedder, wordSplitter),
      this.overlayFrameRenderer ?? new BrowserOverlayFrameRenderer(),
      new LayeredFrameCompositor(),
    );
    return new MediaBunnyVideoRenderer({
      coordinator,
      codecPolicy: new DefaultCodecPolicy(),
      painterFactory,
    });
  }

  private buildDefaultSubtitleLayerSource(
    cssResourceEmbedder: CssResourceEmbedder,
    wordSplitter: WordSplitter,
  ): ComposedSubtitleLayerSource {
    return new ComposedSubtitleLayerSource(
      new BatchedSubtitleLayerSource(this.resolveSubtitleFrameRenderer(cssResourceEmbedder, wordSplitter)),
      new VideoBoundSubtitleLayerSource(this.resolveSubtitleFrameRenderer(cssResourceEmbedder, wordSplitter)),
    );
  }

  // Each layer source gets its own subtitle frame renderer when the
  // builder owns the default: the two sources hold independent open()
  // state that would clash on a shared instance. A consumer-supplied
  // renderer is reused as-is — sharing is then the consumer's call.
  private resolveSubtitleFrameRenderer(
    cssResourceEmbedder: CssResourceEmbedder,
    wordSplitter: WordSplitter,
  ): SubtitleFrameRenderer {
    if (this.subtitleFrameRenderer !== null) return this.subtitleFrameRenderer;
    return BrowserSubtitleFrameRenderer.create(cssResourceEmbedder, wordSplitter);
  }
}
