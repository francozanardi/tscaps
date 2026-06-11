import type { Document } from '@modules/document/Document';
import type { Transcriber, TranscriberOptions } from '@modules/transcription/Transcriber';
import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { BalancedPixelWidthLineSplitter } from '@modules/splitting/BalancedPixelWidthLineSplitter';
import { DomProbeCanvasTextMeasurer } from '@modules/splitting/DomProbeCanvasTextMeasurer';
import type { Tagger } from '@modules/tagging/Tagger';
import type { Effect } from '@modules/effect/Effect';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { VideoRenderer } from '@modules/video/VideoRenderer';
import type {
  RenderJob,
  RenderResult,
  OutputFormat,
  RenderQuality,
  RenderOutputChunk,
  AudioDiscardReason,
  FallbackDecoderInfo,
} from '@modules/video/RenderJob';
import type { PipelineProgressListener } from '@modules/pipeline/PipelineProgress';

/** Px resolution; either supplied up front or probed from the input video. */
export interface OutputResolution {
  readonly width: number;
  readonly height: number;
}

/**
 * Knobs that influence the lazily-built default line splitter. Honoured
 * only when no explicit `LineSplitter` was supplied to the pipeline.
 */
export interface DefaultLineSplitterRuntimeConfig {
  readonly maxLines: number;
  readonly minLines: number;
  readonly maxWidthRatio: number;
}

export interface RenderPipelineConfig {
  readonly video: File | Blob;
  readonly transcriber: Transcriber;
  readonly transcriberOptions: TranscriberOptions | undefined;
  readonly segmentSplitter: SegmentSplitter;
  /** Explicit line splitter; when `null`, a default is built lazily once the resolved css and output dimensions are known. */
  readonly lineSplitter: LineSplitter | null;
  readonly defaultLineSplitterConfig: DefaultLineSplitterRuntimeConfig;
  readonly structureTagger: Tagger;
  readonly semanticTaggers: ReadonlyArray<Tagger>;
  readonly effects: ReadonlyArray<Effect>;
  /** Applied to every `Section.kind` found in the document unless `explicitStyles` is set. */
  readonly defaultStyle: SubtitleStyle;
  /** When set, takes over from `defaultStyle` and is passed as-is to the video renderer. */
  readonly explicitStyles: Readonly<Record<string, SubtitleStyle>> | null;
  readonly videoRenderer: VideoRenderer;
  readonly outputFormat: OutputFormat | undefined;
  readonly quality: RenderQuality | undefined;
  readonly outputResolution: OutputResolution | undefined;
  readonly outputStream: WritableStream<RenderOutputChunk> | undefined;
  readonly overlayHtml: string | undefined;
  readonly onAudioDiscarded: ((reason: AudioDiscardReason) => void) | undefined;
  readonly confirmFallbackDecoder: ((info: FallbackDecoderInfo) => Promise<boolean>) | undefined;
}

/**
 * Orchestrates the end-to-end render flow over the components supplied
 * by `RenderPipelineBuilder`: transcribe → split → tag (structural and
 * semantic) → apply effects → render. Each step is also exposed
 * individually so callers can inspect or mutate the current `Document`
 * between stages.
 *
 * The pipeline owns the current `Document`. After a step it stores the
 * result and feeds it to the next step; `getDocument`/`setDocument`
 * give callers a read/replace handle for that state. `run` short-
 * circuits through every step in order; if a Document is already
 * loaded (whether from a previous step or via `setDocument`), it skips
 * the transcription step and starts from splitting.
 *
 * Instances are built by `RenderPipelineBuilder.build` — the builder
 * is the supported construction surface.
 */
export class RenderPipeline {
  private currentDocument: Document | null = null;
  private cachedVideoDimensions: OutputResolution | null = null;
  private cachedVideoFile: File | null = null;

  constructor(private readonly config: RenderPipelineConfig) {}

  /** Current document state; `null` before transcription runs. */
  getDocument(): Document | null {
    return this.currentDocument;
  }

  /** Replaces the current document — typical after a manual edit between steps. */
  setDocument(document: Document): void {
    this.currentDocument = document;
  }

  /**
   * Runs every step in order and returns the final render result.
   * Skips transcription when a document is already loaded.
   */
  async run(onProgress?: PipelineProgressListener): Promise<RenderResult> {
    if (this.currentDocument === null) {
      await this.runTranscriptionStep(onProgress);
    }
    await this.runSplittingStep(onProgress);
    this.runStructuralTaggingStep(onProgress);
    await this.runSemanticTaggingStep(onProgress);
    this.runEffectsStep(onProgress);
    return this.runRenderingStep(onProgress);
  }

  async runTranscriptionStep(onProgress?: PipelineProgressListener): Promise<Document> {
    const transcriber = this.config.transcriber;
    const previous = transcriber.onProgress;
    transcriber.onProgress = (event) => onProgress?.({ stage: 'transcribing', inner: event });
    try {
      const document = await transcriber.transcribe(this.config.video, this.config.transcriberOptions);
      this.currentDocument = document;
      return document;
    } finally {
      this.restoreTranscriberProgressHandler(transcriber, previous);
    }
  }

  private restoreTranscriberProgressHandler(
    transcriber: Transcriber,
    previous: Transcriber['onProgress'],
  ): void {
    if (previous === undefined) {
      delete transcriber.onProgress;
    } else {
      transcriber.onProgress = previous;
    }
  }

  async runSplittingStep(onProgress?: PipelineProgressListener): Promise<Document> {
    const document = this.requireDocument('splitting');
    onProgress?.({ stage: 'splitting', status: 'started' });
    const segmentSplit = this.applySegmentSplitterToSections(document);
    const lineSplit = await this.applyLineSplittingToSections(segmentSplit);
    this.currentDocument = lineSplit;
    onProgress?.({ stage: 'splitting', status: 'completed' });
    return lineSplit;
  }

  runStructuralTaggingStep(onProgress?: PipelineProgressListener): Document {
    const document = this.requireDocument('structural tagging');
    onProgress?.({ stage: 'tagging-structural', status: 'started' });
    const tagged = this.config.structureTagger.tag(document);
    this.currentDocument = tagged;
    onProgress?.({ stage: 'tagging-structural', status: 'completed' });
    return tagged;
  }

  async runSemanticTaggingStep(onProgress?: PipelineProgressListener): Promise<Document> {
    const document = this.requireDocument('semantic tagging');
    onProgress?.({ stage: 'tagging-semantic', status: 'started' });
    let result = document;
    for (const tagger of this.config.semanticTaggers) {
      result = await tagger.tag(result);
    }
    this.currentDocument = result;
    onProgress?.({ stage: 'tagging-semantic', status: 'completed' });
    return result;
  }

  runEffectsStep(onProgress?: PipelineProgressListener): Document {
    const document = this.requireDocument('effects');
    onProgress?.({ stage: 'applying-effects', status: 'started' });
    let result = document;
    for (const effect of this.config.effects) {
      result = effect.apply(result);
    }
    this.currentDocument = result;
    onProgress?.({ stage: 'applying-effects', status: 'completed' });
    return result;
  }

  async runRenderingStep(onProgress?: PipelineProgressListener): Promise<RenderResult> {
    const document = this.requireDocument('rendering');
    const styles = this.resolveStylesForDocument(document);
    const job = this.buildRenderJob(document, styles);
    return this.config.videoRenderer.render(job, (progress) => {
      onProgress?.({ stage: 'rendering', inner: progress });
    });
  }

  private requireDocument(stageName: string): Document {
    if (this.currentDocument === null) {
      throw new Error(`RenderPipeline: cannot run ${stageName} step — no document loaded yet`);
    }
    return this.currentDocument;
  }

  private applySegmentSplitterToSections(document: Document): Document {
    const sections = document.sections.map((section) =>
      section.with({ segments: this.config.segmentSplitter.split(section.segments) }),
    );
    return document.with({ sections });
  }

  private async applyLineSplittingToSections(document: Document): Promise<Document> {
    const lineSplitter = await this.resolveLineSplitter();
    if (lineSplitter === null) return document;
    const sections = document.sections.map((section) =>
      section.with({ segments: lineSplitter.split(section.segments) }),
    );
    return document.with({ sections });
  }

  private async resolveLineSplitter(): Promise<LineSplitter | null> {
    if (this.config.lineSplitter !== null) return this.config.lineSplitter;
    // The default measurer needs one resolved css + one output size to
    // anchor its probe. With explicit per-kind styles the consumer has
    // gone beyond a single visual rule, so the default doesn't fit;
    // they must supply their own LineSplitter.
    if (this.config.explicitStyles !== null) return null;
    return this.buildDefaultLineSplitter();
  }

  private async buildDefaultLineSplitter(): Promise<LineSplitter> {
    const dimensions = await this.resolveOutputDimensions();
    const measurer = new DomProbeCanvasTextMeasurer({
      css: this.config.defaultStyle.css,
      cssVars: this.extractCssVariablesFromInlineStyles(this.config.defaultStyle.inlineStyles),
      containerWidth: dimensions.width,
      containerHeight: dimensions.height,
    });
    const { maxLines, minLines, maxWidthRatio } = this.config.defaultLineSplitterConfig;
    return new BalancedPixelWidthLineSplitter(
      {
        maxLines,
        minLines,
        maxWidth: Math.round(dimensions.width * maxWidthRatio),
      },
      measurer,
    );
  }

  private extractCssVariablesFromInlineStyles(
    inlineStyles: Readonly<Record<string, string>>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(inlineStyles)) {
      if (key.startsWith('--')) result[key] = value;
    }
    return result;
  }

  private async resolveOutputDimensions(): Promise<OutputResolution> {
    if (this.config.outputResolution !== undefined) return this.config.outputResolution;
    if (this.cachedVideoDimensions !== null) return this.cachedVideoDimensions;
    this.cachedVideoDimensions = await this.probeVideoNaturalDimensions(this.config.video);
    return this.cachedVideoDimensions;
  }

  private probeVideoNaturalDimensions(video: Blob): Promise<OutputResolution> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(video);
      const element = document.createElement('video');
      element.preload = 'metadata';
      element.muted = true;
      element.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({ width: element.videoWidth, height: element.videoHeight });
      };
      element.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to read video metadata while probing natural dimensions'));
      };
      element.src = url;
    });
  }

  private resolveStylesForDocument(document: Document): Readonly<Record<string, SubtitleStyle>> {
    if (this.config.explicitStyles !== null) return this.config.explicitStyles;
    const styles: Record<string, SubtitleStyle> = {};
    for (const section of document.sections) {
      styles[section.kind] = this.config.defaultStyle;
    }
    return styles;
  }

  private buildRenderJob(document: Document, styles: Readonly<Record<string, SubtitleStyle>>): RenderJob {
    return {
      video: this.resolveVideoAsFile(),
      document,
      styles,
      ...(this.config.overlayHtml !== undefined && { overlayHtml: this.config.overlayHtml }),
      ...(this.config.outputFormat !== undefined && { outputFormat: this.config.outputFormat }),
      ...(this.config.quality !== undefined && { quality: this.config.quality }),
      ...(this.config.outputResolution !== undefined && { outputResolution: this.config.outputResolution }),
      ...(this.config.outputStream !== undefined && { outputStream: this.config.outputStream }),
      ...(this.config.onAudioDiscarded !== undefined && { onAudioDiscarded: this.config.onAudioDiscarded }),
      ...(this.config.confirmFallbackDecoder !== undefined && { confirmFallbackDecoder: this.config.confirmFallbackDecoder }),
    };
  }

  /**
   * The video renderer's job expects a `File`. Inputs that arrive as a
   * raw `Blob` are wrapped once and reused across runs so the same
   * underlying bytes back every render call.
   */
  private resolveVideoAsFile(): File {
    if (this.cachedVideoFile !== null) return this.cachedVideoFile;
    const source = this.config.video;
    this.cachedVideoFile = source instanceof File
      ? source
      : new File([source], 'input', { type: source.type });
    return this.cachedVideoFile;
  }
}
