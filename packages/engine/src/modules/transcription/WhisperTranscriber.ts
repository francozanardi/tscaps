import type { pipeline, WhisperTextStreamer, LogitsProcessorList } from '@huggingface/transformers';
import { Document, Section, Segment, Line, Word, TimeFragment } from '@modules/document/index';
import { TransformersRuntime } from '@modules/transcription/TransformersRuntime';
import type { AudioDecoder } from '@modules/transcription/AudioDecoder';
import type { ModelAssetSources } from '@modules/transcription/ModelAssetSources';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
  UntranscribedRegion,
} from '@modules/transcription/Transcriber';
import { WhisperDeviceUnavailableError } from '@modules/transcription/WhisperDeviceUnavailableError';
import { WhisperInferenceFailedError } from '@modules/transcription/WhisperInferenceFailedError';
import { WhisperInferenceProgressTracker } from '@modules/transcription/WhisperInferenceProgressTracker';
import { WhisperWindowCoverage, type CoverageGap } from '@modules/transcription/WhisperWindowCoverage';
import { WhisperLoopAbortLogitsProcessor } from '@modules/transcription/WhisperLoopAbortLogitsProcessor';
import { LogitsProcessorListFactory } from '@modules/transcription/LogitsProcessorListFactory';
import { WhisperChunkStitcher, type WhisperChunk } from '@modules/transcription/WhisperChunkStitcher';
import { WhisperModelLoadFailedError } from '@modules/transcription/WhisperModelLoadFailedError';

export const WHISPER_SAMPLE_RATE = 16_000;

export type WhisperModel =
  | 'tiny'
  | 'base'
  | 'small'
  | 'medium'
  | 'distil-small.en'
  | 'distil-medium.en';

export type WhisperDevice = 'auto' | 'wasm' | 'webgpu';

export interface WhisperTranscriberConfig {
  model?: WhisperModel;
  device?: WhisperDevice;
}

const MODEL_IDS: Record<WhisperModel, string> = {
  'tiny':             'onnx-community/whisper-tiny_timestamped',
  'base':             'onnx-community/whisper-base_timestamped',
  'small':            'onnx-community/whisper-small_timestamped',
  'medium':           'onnx-community/whisper-medium_timestamped',
  'distil-small.en':  'distil-whisper/distil-small.en',
  'distil-medium.en': 'distil-whisper/distil-medium.en',
};

const CHUNK_CONFIG: Record<WhisperModel, { chunk_length_s: number; stride_length_s: number }> = {
  'tiny':             { chunk_length_s: 30, stride_length_s: 5 },
  'base':             { chunk_length_s: 30, stride_length_s: 5 },
  'small':            { chunk_length_s: 30, stride_length_s: 5 },
  'medium':           { chunk_length_s: 30, stride_length_s: 5 },
  'distil-small.en':  { chunk_length_s: 20, stride_length_s: 3 },
  'distil-medium.en': { chunk_length_s: 20, stride_length_s: 3 },
};

type ResolvedDevice = 'wasm' | 'webgpu';
type DType = string | { encoder_model: string; decoder_model_merged: string };

/**
 * Per-model dtype table indexed by resolved device. `webgpu: null` means the
 * model's repository does not ship a dtype that works on WebGPU and the
 * model must run on WASM.
 *
 * On WebGPU we quantize the decoder to q4 (encoder stays fp32; Whisper is
 * very sensitive to encoder quantization). The GPU's compute units benefit
 * from low-bit weights — bandwidth is the bottleneck there, so q4 gives a
 * 2-4× win.
 *
 * On WASM we run q8. On a base-sized model the download drops from 278 MB
 * (fp32) to 73 MB and end-to-end inference gets ~25% faster than fp32 on
 * the same isolated worker — halved weight bandwidth beats the int8→fp32
 * conversion cost by a comfortable margin. Whisper is quantization-
 * tolerant (WER shift typically well under 1% absolute).
 *
 * q8 on the `_timestamped` exports crashes session creation under the
 * `onnxruntime-web` dev build transformers.js@4.2.0 pins — the v4-runtime
 * optimizer rewrites QDQ into MatMulNBits and demands scale tensors the
 * older exports do not carry (transformers.js#1707, microsoft/
 * onnxruntime#28306). The workspace overrides `onnxruntime-web` to 1.27.0,
 * which carries the fix; the override goes away when transformers.js
 * ships v4.3.0 with a bundled fix.
 *
 * fp16 on WASM crashes a *different* optimizer against the same older
 * exports (`SimplifiedLayerNormFusion` aborts on a `PrecisionFreeCast`
 * node name that never got inserted). Not covered by the ORT 1.27 fix
 * above; deserves its own upstream issue.
 *
 * q4 on WASM was measured slower than fp32 with older tooling; not re-
 * benchmarked and likely irrelevant given q8 already wins on both size
 * and speed.
 *
 * The distil-whisper repos don't ship the dtypes WebGPU needs
 * (huggingface/transformers.js#1317), so they stay on WASM at q8.
 */
const DTYPE_BY_DEVICE: Record<WhisperModel, { wasm: DType; webgpu: DType | null }> = {
  'tiny':             { wasm: 'q8', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'base':             { wasm: 'q8', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'small':            { wasm: 'q8', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'medium':           { wasm: 'q8', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'distil-small.en':  { wasm: 'q8', webgpu: null },
  'distil-medium.en': { wasm: 'q8', webgpu: null },
};

// Whisper's decoder holds 448 positions, four of which the pipeline spends on
// the prefix tokens (start-of-transcript, language, task, timestamp mode), so
// 444 is the model's own generation ceiling. As a cap it is a no-op: it stops
// generation exactly where the model's `max_length: 448` already would.
//
// It is passed for its side effect. transformers.js only enters
// `_generate_with_seek` — Python's long-form seek loop — when `max_new_tokens`
// is absent. Layered over `chunk_length_s` windowing (in Python they are
// alternative long-form strategies, never combined), that loop re-decodes each
// window's leftover tail zero-padded back to a full 30 s mel, feeding the model
// long stretches of digital silence — a known hallucination trigger for
// Whisper. Passing the ceiling as an explicit cap opts out of the layering
// without changing any decoding limit.
const MAX_NEW_TOKENS_PER_WINDOW = 444;

type WhisperResult = { text: string; chunks: WhisperChunk[] };
type LoadProgressEvent = { status: string; progress?: number };

// transformers.js fires both `progress` (per-file) and `progress_total`
// (aggregate across all files) on the same callback. The per-file event
// jumps each time a new file starts (it resets to 0), so we listen only
// to the aggregate. See @huggingface/transformers `DefaultProgressCallback`.
const AGGREGATE_LOAD_STATUS = 'progress_total';

/**
 * Client-side Whisper transcriber, powered by @huggingface/transformers.js.
 * Model weights are downloaded from HuggingFace Hub and cached in the browser
 * on first use.
 *
 * The default `device: 'auto'` probes for WebGPU at load time and falls back
 * to WASM.
 *
 * Audio decoding is delegated to an injected AudioDecoder so this class can
 * run in any context: on the main thread with a Web-Audio-backed decoder, or
 * in a Web Worker (where browser audio APIs are unavailable) with a pre-
 * decoded byte-stream decoder.
 *
 * Progress reporting is real-only for both stages. The loading stage
 * tracks model weight download from HuggingFace. The inferring stage
 * hooks a `WhisperTextStreamer` into `model.generate` so each
 * pipeline-window boundary that Whisper predicts translates into an
 * `[0, 1]` fraction of the audio processed so far. Clips short enough to
 * fit in a single window emit no boundaries — the field stays at zero
 * and the consumer can only render that as indeterminate.
 *
 * Coverage policy: every pipeline window's decoding is audited. A
 * non-final window that ended by its own end-of-sequence but left
 * audio before the next window's start gets one re-decode over real
 * audio from that point. A window cut from outside — the repetition-
 * loop guard or the token ceiling — is degenerate: its unclosed tail
 * is dropped and its region is deliberately left untranscribed, never
 * retried. A re-decode that degenerates too is discarded the same way.
 * The final window is reported the same way when cut or stopped
 * mid-segment; a clean close there is trusted as the end of speech.
 */
export class WhisperTranscriber implements Transcriber {
  private readonly model: WhisperModel;
  private readonly device: WhisperDevice;
  private readonly chunkStitcher: WhisperChunkStitcher;
  private readonly transformers: TransformersRuntime;
  private processorLists: LogitsProcessorListFactory | null = null;
  private pipelinePromise: ReturnType<typeof pipeline> | null = null;

  constructor(
    private readonly decoder: AudioDecoder,
    { model = 'base', device = 'auto' }: WhisperTranscriberConfig = {},
    assetSources: ModelAssetSources = {},
  ) {
    this.model = model;
    this.device = device;
    const { chunk_length_s, stride_length_s } = CHUNK_CONFIG[model];
    this.chunkStitcher = new WhisperChunkStitcher(chunk_length_s, stride_length_s);
    this.transformers = new TransformersRuntime(assetSources);
  }

  onProgress?: (event: TranscriberProgressEvent) => void;
  onUntranscribedRegion?: (region: UntranscribedRegion) => void;

  async transcribe(audio: Blob, options?: TranscriberOptions): Promise<Document> {
    const transcriber = await this.loadPipelineOrFail();
    const pcm = await this.decoder.decode(audio, WHISPER_SAMPLE_RATE);
    this.onProgress?.({ stage: 'inferring', progress: 0 });
    const durationSeconds = pcm.length / WHISPER_SAMPLE_RATE;
    const tracker = this.buildProgressTracker(durationSeconds);
    const coverage = tracker ? new WhisperWindowCoverage() : null;
    const loopGuard = this.buildLoopGuard(transcriber);
    const streamer = tracker && coverage
      ? await this.buildProgressStreamer(transcriber, tracker, coverage, loopGuard)
      : null;
    const rawChunks = await this.runInferenceOrFail(transcriber, pcm, options, streamer, loopGuard);
    const mainChunks = this.chunkStitcher.stitch(rawChunks, durationSeconds);
    const gaps = tracker && coverage ? this.detectUncoveredGaps(tracker, coverage, durationSeconds) : [];
    const finalChunks = gaps.length === 0
      ? mainChunks
      : await this.redecodeGaps(transcriber, pcm, mainChunks, gaps, options);
    this.onProgress?.({ stage: 'inferring', progress: 1 });
    return this.buildDocument(finalChunks);
  }

  /**
   * Builds the progress tracker for this audio, or `null` when a single
   * pipeline window covers everything — no window boundary is ever
   * reported then, so the progress bar stays indeterminate.
   */
  private buildProgressTracker(audioDurationSeconds: number): WhisperInferenceProgressTracker | null {
    const { chunk_length_s, stride_length_s } = CHUNK_CONFIG[this.model];
    if (audioDurationSeconds <= chunk_length_s) return null;
    return new WhisperInferenceProgressTracker(
      audioDurationSeconds,
      chunk_length_s,
      stride_length_s,
    );
  }

  /**
   * Builds a `WhisperTextStreamer` that translates Whisper's per-window
   * timestamp emissions into `[0, 1]` inference progress and feeds the
   * per-window coverage record.
   *
   * `on_finalize` fires at the end of every `model.generate` call — one
   * per pipeline window while the long-form layering stays opted out —
   * which makes it the exact window delimiter the coverage record needs.
   * It is deliberately not wired to progress: the terminal `progress: 1`
   * can only come from the caller, after the whole call returns.
   */
  private async buildProgressStreamer(
    transcriber: Awaited<ReturnType<typeof pipeline>>,
    tracker: WhisperInferenceProgressTracker,
    coverage: WhisperWindowCoverage,
    loopGuard: WhisperLoopAbortLogitsProcessor | null,
  ): Promise<WhisperTextStreamer> {
    const { WhisperTextStreamer } = await this.transformers.load();
    const tokenizer = (transcriber as unknown as { tokenizer: never }).tokenizer;
    return new WhisperTextStreamer(tokenizer, {
      on_chunk_start: (timeWithinChunk: number) => coverage.recordTimestamp(timeWithinChunk),
      on_chunk_end: (timeWithinChunk: number) => {
        coverage.recordTimestamp(timeWithinChunk);
        const progress = tracker.observeChunkEnd(timeWithinChunk);
        this.onProgress?.({ stage: 'inferring', progress });
      },
      on_finalize: () => coverage.windowEnded(loopGuard?.consumeFired() ?? false),
      token_callback_function: () => coverage.recordToken(),
      // Silences the default `stdout_write` fallback in TextStreamer,
      // which prints every decoded token to the console.
      callback_function: () => {},
    });
  }

  /**
   * Builds the anti-loop guard for a generation, or `null` when the
   * model's end-of-sequence token cannot be located — the guard can
   * only abort by forcing that token.
   */
  private buildLoopGuard(
    transcriber: Awaited<ReturnType<typeof pipeline>>,
  ): WhisperLoopAbortLogitsProcessor | null {
    const model = (transcriber as unknown as {
      model?: { generation_config?: { eos_token_id?: unknown }; config?: { eos_token_id?: unknown } };
    }).model;
    const raw = model?.generation_config?.eos_token_id ?? model?.config?.eos_token_id;
    const endOfSequenceTokenId = Array.isArray(raw) ? raw[0] : raw;
    if (typeof endOfSequenceTokenId !== 'number') {
      console.warn('[whisper] end-of-sequence token id not found; running without the loop guard.');
      return null;
    }
    return new WhisperLoopAbortLogitsProcessor(endOfSequenceTokenId);
  }

  private async loadPipelineOrFail(): Promise<ReturnType<typeof pipeline>> {
    try {
      return await this.loadPipeline();
    } catch (cause) {
      if (cause instanceof WhisperDeviceUnavailableError) throw cause;
      throw new WhisperModelLoadFailedError('Whisper pipeline could not be loaded.', { cause });
    }
  }

  private async runInferenceOrFail(
    transcriber: Awaited<ReturnType<typeof pipeline>>,
    pcm: Float32Array,
    options?: TranscriberOptions,
    streamer?: WhisperTextStreamer | null,
    loopGuard?: WhisperLoopAbortLogitsProcessor | null,
  ): Promise<WhisperChunk[]> {
    try {
      console.time('whisper.inference');
      const result = (await (transcriber as CallableFunction)(
        pcm,
        await this.buildPipelineOptions(options, streamer, loopGuard),
      )) as WhisperResult;
      console.timeEnd('whisper.inference');
      return result.chunks ?? [];
    } catch (cause) {
      throw new WhisperInferenceFailedError('Whisper inference call rejected.', { cause });
    }
  }

  /**
   * Loads the pipeline once and reuses it for every later call.
   *
   * A failed load is *not* kept. The weights arrive over the network
   * and the common failure is a transfer that dies partway, which the
   * next attempt may well complete; caching the rejection would make
   * every retry fail instantly without ever reaching the network
   * again, leaving a reload as the only way out.
   */
  private loadPipeline(): ReturnType<typeof pipeline> {
    if (this.pipelinePromise === null) {
      const attempt = (async () => {
        const { pipeline } = await this.transformers.load();
        const device = await this.resolveDevice();
        console.log(`Using device "${device}" for Whisper model "${this.model}".`);
        const dtype = DTYPE_BY_DEVICE[this.model][device]!;
        return pipeline(
          'automatic-speech-recognition',
          MODEL_IDS[this.model],
          {
            device,
            dtype: dtype as never,
            progress_callback: (data: LoadProgressEvent) => this.handleLoadProgress(data),
          },
        );
      })();
      attempt.catch(() => {
        if (this.pipelinePromise === attempt) this.pipelinePromise = null;
      });
      this.pipelinePromise = attempt;
    }
    return this.pipelinePromise;
  }

  private async resolveDevice(): Promise<ResolvedDevice> {
    const webgpuSupportedByModel = DTYPE_BY_DEVICE[this.model].webgpu !== null;
    if (this.device === 'wasm') return 'wasm';
    if (this.device === 'webgpu') {
      if (!webgpuSupportedByModel) {
        throw new WhisperDeviceUnavailableError(
          `Whisper model "${this.model}" does not ship WebGPU artefacts.`,
        );
      }
      if (!(await this.isWebGPUAvailable())) {
        throw new WhisperDeviceUnavailableError(
          'WebGPU is not exposed by this browser.',
        );
      }
      return 'webgpu';
    }
    if (!webgpuSupportedByModel) return 'wasm';
    return (await this.isWebGPUAvailable()) ? 'webgpu' : 'wasm';
  }

  private async isWebGPUAvailable(): Promise<boolean> {
    try {
      const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      if (!gpu) return false;
      const adapter = await gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  private async buildPipelineOptions(
    options?: TranscriberOptions,
    streamer?: WhisperTextStreamer | null,
    loopGuard?: WhisperLoopAbortLogitsProcessor | null,
  ) {
    return {
      sampling_rate: WHISPER_SAMPLE_RATE,
      return_timestamps: 'word' as const,
      max_new_tokens: MAX_NEW_TOKENS_PER_WINDOW,
      language: options?.language ?? null,
      task: 'transcribe' as const,
      ...CHUNK_CONFIG[this.model],
      ...(streamer ? { streamer } : {}),
      ...(loopGuard ? { logits_processor: await this.buildProcessorList(loopGuard) } : {}),
    };
  }

  /**
   * The factory is built from the loaded library, so it is reached
   * through the same load the pipeline came from rather than held from
   * construction. By the time any generation runs, that load is settled.
   */
  private async buildProcessorList(
    loopGuard: WhisperLoopAbortLogitsProcessor,
  ): Promise<LogitsProcessorList> {
    if (this.processorLists === null) {
      this.processorLists = new LogitsProcessorListFactory(await this.transformers.load());
    }
    return this.processorLists.build(loopGuard);
  }

  private handleLoadProgress(data: LoadProgressEvent): void {
    if (data.status === AGGREGATE_LOAD_STATUS && data.progress !== undefined) {
      this.onProgress?.({
        stage: 'loading',
        progress: data.progress / 100,
      });
    }
  }

  /**
   * The audio regions the main pass left uncovered. Empty when the
   * number of generation passes does not match the expected window
   * layout — that means the underlying pipeline changed its long-form
   * behaviour and per-window attribution can no longer be trusted.
   */
  private detectUncoveredGaps(
    tracker: WhisperInferenceProgressTracker,
    coverage: WhisperWindowCoverage,
    durationSeconds: number,
  ): CoverageGap[] {
    const expectedWindows = tracker.windowLayout.length;
    if (coverage.windowsObserved !== expectedWindows) {
      console.warn(
        `[whisper] expected ${expectedWindows} pipeline windows but observed ` +
        `${coverage.windowsObserved} generation passes; skipping coverage rescue.`,
      );
      return [];
    }
    const gaps = coverage.uncoveredGaps(tracker.advanceSeconds, MAX_NEW_TOKENS_PER_WINDOW);
    const finalGap = coverage.finalWindowGap(tracker.advanceSeconds, MAX_NEW_TOKENS_PER_WINDOW, durationSeconds);
    return finalGap ? [...gaps, finalGap] : gaps;
  }

  /**
   * Replaces the content of every uncovered gap. The main pass's words
   * inside a gap come from tokens past their window's last closed
   * segment — the same unclosed tail the reference Whisper decoder
   * discards before re-decoding — so they are dropped. Dropping is safe
   * because the word-timestamp alignment is monotonic in token order:
   * no word of a closed segment lands past that segment's end.
   *
   * A rescuable gap gets one extra pass over real audio. A
   * non-rescuable gap does not — its region is reported and left
   * untranscribed rather than retried.
   */
  private async redecodeGaps(
    transcriber: Awaited<ReturnType<typeof pipeline>>,
    pcm: Float32Array,
    main: WhisperChunk[],
    gaps: CoverageGap[],
    options?: TranscriberOptions,
  ): Promise<WhisperChunk[]> {
    const kept = main.filter((chunk) => !this.isInsideAnyGap(chunk, gaps));
    const rescued: WhisperChunk[] = [];
    for (const gap of gaps) {
      if (!gap.rescuable) {
        console.warn(
          `[whisper] window ended without trustworthy coverage; leaving ` +
          `[${gap.startSeconds.toFixed(2)}s, ${gap.endSeconds.toFixed(2)}s] untranscribed.`,
        );
        this.reportUntranscribed(gap);
        continue;
      }
      rescued.push(...await this.rescueGap(transcriber, pcm, gap, options));
    }
    return this.mergeChunks(kept, rescued);
  }

  private isInsideAnyGap(chunk: WhisperChunk, gaps: CoverageGap[]): boolean {
    const anchor = chunk.timestamp[0] ?? chunk.timestamp[1];
    if (anchor === null) return false;
    return gaps.some((gap) => anchor >= gap.startSeconds && anchor < gap.endSeconds);
  }

  /**
   * Runs one extra decoding pass over a full window of real audio
   * starting at the gap and keeps the words that fall inside it. Words
   * past the gap's end are dropped — the next pipeline window already
   * covers that region.
   *
   * Best-effort by design: the main transcription is already in hand, so
   * a failed rescue logs and contributes nothing instead of failing the
   * whole call.
   */
  private async rescueGap(
    transcriber: Awaited<ReturnType<typeof pipeline>>,
    pcm: Float32Array,
    gap: CoverageGap,
    options?: TranscriberOptions,
  ): Promise<WhisperChunk[]> {
    const { chunk_length_s } = CHUNK_CONFIG[this.model];
    const label = `[${gap.startSeconds.toFixed(2)}s, ${gap.endSeconds.toFixed(2)}s]`;
    console.warn(`[whisper] window closed early; re-decoding ${label} from real audio.`);
    try {
      const startSample = Math.floor(gap.startSeconds * WHISPER_SAMPLE_RATE);
      const endSample = Math.min(pcm.length, startSample + chunk_length_s * WHISPER_SAMPLE_RATE);
      const slice = pcm.subarray(startSample, endSample);
      const rescueGuard = this.buildLoopGuard(transcriber);
      const result = (await (transcriber as CallableFunction)(
        slice,
        await this.buildPipelineOptions(options, null, rescueGuard),
      )) as WhisperResult;
      if (rescueGuard?.consumeFired()) {
        console.warn(`[whisper] rescue for ${label} degenerated as well; leaving the region untranscribed.`);
        this.reportUntranscribed(gap);
        return [];
      }
      const recovered = this.chunksWithinGap(result.chunks ?? [], gap);
      console.log(`[whisper] rescue recovered ${recovered.length} words for ${label}.`);
      return recovered;
    } catch (cause) {
      console.warn('[whisper] gap rescue failed; keeping the main transcription only.', cause);
      this.reportUntranscribed(gap);
      return [];
    }
  }

  private reportUntranscribed(gap: CoverageGap): void {
    this.onUntranscribedRegion?.({ startSeconds: gap.startSeconds, endSeconds: gap.endSeconds });
  }

  /**
   * Shifts slice-relative rescue chunks to absolute time and keeps the
   * ones anchored inside the gap. A chunk with no usable timestamp
   * cannot be placed and is dropped.
   */
  private chunksWithinGap(chunks: WhisperChunk[], gap: CoverageGap): WhisperChunk[] {
    return chunks
      .map(({ text, timestamp: [start, end] }): WhisperChunk => ({
        text,
        timestamp: [
          start === null ? null : start + gap.startSeconds,
          end === null ? null : end + gap.startSeconds,
        ],
      }))
      .filter(({ timestamp: [start, end] }) => {
        const anchor = start ?? end;
        return anchor !== null && anchor < gap.endSeconds;
      });
  }

  private mergeChunks(main: WhisperChunk[], rescued: WhisperChunk[]): WhisperChunk[] {
    if (rescued.length === 0) return main;
    const anchor = ({ timestamp: [start, end] }: WhisperChunk) => start ?? end ?? 0;
    return [...main, ...rescued].sort((a, b) => anchor(a) - anchor(b));
  }

  private buildDocument(chunks: WhisperChunk[]): Document {
    const words = chunks
      .map(({ text, timestamp: [start, end] }) =>
        new Word({ text: text.trim(), time: new TimeFragment(start ?? 0, end ?? start ?? 0) }),
      )
      .filter((w) => w.text.length > 0);
    return new Document({
      sections: [new Section({
        segments: [new Segment({ lines: [new Line({ words })] })],
        kind: '',
      })],
    });
  }
}
