import type { Transcriber, TranscriberOptions } from '@modules/transcription/Transcriber';
import { WhisperTranscriber } from '@modules/transcription/WhisperTranscriber';
import { MediaBunnyAudioDecoder } from '@modules/transcription/MediaBunnyAudioDecoder';
import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { LineSplitter } from '@modules/splitting/LineSplitter';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { CompositeSegmentSplitter } from '@modules/splitting/CompositeSegmentSplitter';
import { BoundarySegmentSplitter } from '@modules/splitting/BoundarySegmentSplitter';
import { LimitByScaledCharsSegmentSplitter } from '@modules/splitting/LimitByScaledCharsSegmentSplitter';
import type { Tagger } from '@modules/tagging/Tagger';
import { StructureTagger } from '@modules/tagging/StructureTagger';
import type { Effect } from '@modules/effect/Effect';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { RenderingConfig } from '@modules/rendering/types/RenderingConfig';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { VideoRenderer } from '@modules/video/VideoRenderer';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import type {
  OutputFormat,
  RenderQuality,
  RenderOutputChunk,
  RenderFootage,
  RenderAudioMix,
  RenderBackground,
  AudioDiscardReason,
  AudioMixDropReason,
  FallbackDecoderInfo,
  VideoFrameDecoderSelection,
  VideoEncoderSelection,
} from '@modules/video/RenderJob';
import { MediaBunnyRenderers } from '@modules/video/mediabunny/MediaBunnyRenderers';
import { RenderPipeline } from '@modules/pipeline/RenderPipeline';
import type { RenderPipelineConfig, RenderPipelineJobSettings } from '@modules/pipeline/RenderPipeline';

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

// A centred caption at `maxWidthRatio` leaves half of what it does not take
// clear on each side, and the short-form players draw an action rail down the
// right edge — the widest of them claims around 11% of the width. Anything
// past 0.78 puts a full line under it, so the default sits below that with
// room for the rail's own imprecision.
const DEFAULT_LINE_SPLITTER_CONFIG: DefaultLineSplitterConfig = {
  maxLines: 2,
  minLines: 1,
  maxWidthRatio: 0.72,
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
  textDirection: 'ltr',
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
 * the structural tagger, no semantic taggers, no effects, and the
 * video renderer of `MediaBunnyRenderers`.
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
 *
 * The rest of the render — output shape, footage and audio layers, cuts,
 * cancellation, and what the renderer reports or asks along the way — is
 * set with the remaining `with*` methods, each one field of the
 * `RenderJob` the pipeline hands its video renderer.
 */
export class RenderPipelineBuilder {
  private video: Blob | null = null;

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

  private job: RenderPipelineJobSettings = {};

  private videoRenderer: VideoRenderer | null = null;
  private cssResourceEmbedder: CssResourceEmbedder | null = null;

  withInputVideo(video: Blob): this {
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

  /** Feeds the default video renderer. Ignored once `withVideoRenderer` supplied one. */
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

  /** Replaces the single-style default wholesale; subsequent style shortcuts layer on top of this. */
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
    return this.withJobSettings({ outputFormat: format });
  }

  withOutputResolution(width: number, height: number): this {
    return this.withJobSettings({ outputResolution: { width, height } });
  }

  withQuality(quality: RenderQuality): this {
    return this.withJobSettings({ quality });
  }

  withOutputStream(stream: WritableStream<RenderOutputChunk>): this {
    return this.withJobSettings({ outputStream: stream });
  }

  withOverlayHtml(html: string): this {
    return this.withJobSettings({ overlayHtml: html });
  }

  /** The output frame's own size, where it is not the input's (see `RenderJob.frame`). */
  withFrame(width: number, height: number): this {
    return this.withJobSettings({ frame: { width, height } });
  }

  /** What the captions are painted on (see `RenderJob.background`). */
  withBackground(background: RenderBackground): this {
    return this.withJobSettings({ background });
  }

  /** Footage layers drawn on the video's picture, and the colour grade (see `RenderJob.footage`). */
  withFootage(footage: RenderFootage): this {
    return this.withJobSettings({ footage });
  }

  /** Sounds mixed with the input's audio, and that audio's level (see `RenderJob.audioMix`). */
  withAudioMix(mix: RenderAudioMix): this {
    return this.withJobSettings({ audioMix: mix });
  }

  /** `'discard'` leaves the input's own audio out of the output. */
  withInputAudio(audio: 'keep' | 'discard'): this {
    return this.withJobSettings({ audio });
  }

  /** Stretches of the input, in its own time, cut out of the output (see `RenderJob.skipRanges`). */
  withSkipRanges(ranges: ReadonlyArray<TimeRange>): this {
    return this.withJobSettings({ skipRanges: ranges });
  }

  /** Abandons the render when aborted; it then rejects with an `AbortError`. Transcription is not abandoned. */
  withSignal(signal: AbortSignal): this {
    return this.withJobSettings({ signal });
  }

  withOnAudioDiscarded(callback: (reason: AudioDiscardReason) => void): this {
    return this.withJobSettings({ onAudioDiscarded: callback });
  }

  withOnAudioMixDropped(callback: (reason: AudioMixDropReason) => void): this {
    return this.withJobSettings({ onAudioMixDropped: callback });
  }

  withOnAudioMixInputFallback(callback: (cause: unknown) => void): this {
    return this.withJobSettings({ onAudioMixInputFallback: callback });
  }

  withConfirmFallbackDecoder(callback: (info: FallbackDecoderInfo) => Promise<boolean>): this {
    return this.withJobSettings({ confirmFallbackDecoder: callback });
  }

  withConfirmUndecodableAudioLayers(callback: (layerIds: ReadonlyArray<string>) => Promise<boolean>): this {
    return this.withJobSettings({ confirmUndecodableAudioLayers: callback });
  }

  withOnVideoFrameDecoderSelected(callback: (selection: VideoFrameDecoderSelection) => void): this {
    return this.withJobSettings({ onVideoFrameDecoderSelected: callback });
  }

  withOnVideoEncoderSelected(callback: (selection: VideoEncoderSelection) => void): this {
    return this.withJobSettings({ onVideoEncoderSelected: callback });
  }

  /**
   * Replaces the video renderer. The default is the one of a
   * `MediaBunnyRenderers` built with this builder's word splitter and
   * resource embedder; parts of it are replaced by building one with
   * `overrides` and passing its `videoRenderer` here.
   */
  withVideoRenderer(renderer: VideoRenderer): this {
    this.videoRenderer = renderer;
    return this;
  }

  /** Feeds the default video renderer. Ignored once `withVideoRenderer` supplied one. */
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

  private withJobSettings(settings: RenderPipelineJobSettings): this {
    this.job = { ...this.job, ...settings };
    return this;
  }

  private buildConfig(video: Blob): RenderPipelineConfig {
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
      videoRenderer: this.videoRenderer ?? this.buildDefaultVideoRenderer(),
      job: { ...this.job },
    };
  }

  private buildDefaultVideoRenderer(): VideoRenderer {
    return new MediaBunnyRenderers({
      ...(this.cssResourceEmbedder !== null && { cssResourceEmbedder: this.cssResourceEmbedder }),
      ...(this.wordSplitter !== null && { wordSplitter: this.wordSplitter }),
    }).videoRenderer;
  }

  private buildDefaultTranscriber(): Transcriber {
    return new WhisperTranscriber(new MediaBunnyAudioDecoder());
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
}
