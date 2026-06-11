import { pipeline, env } from '@huggingface/transformers';
import { Document, Section, Segment, Line, Word, TimeFragment } from '@modules/document/index';
import type { AudioDecoder } from '@modules/transcription/AudioDecoder';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
} from '@modules/transcription/Transcriber';

export const WHISPER_SAMPLE_RATE = 16_000;

export type WhisperModel =
  | 'tiny'
  | 'base'
  | 'small'
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
  'distil-small.en':  'distil-whisper/distil-small.en',
  'distil-medium.en': 'distil-whisper/distil-medium.en',
};

const CHUNK_CONFIG: Record<WhisperModel, { chunk_length_s: number; stride_length_s: number }> = {
  'tiny':             { chunk_length_s: 30, stride_length_s: 5 },
  'base':             { chunk_length_s: 30, stride_length_s: 5 },
  'small':            { chunk_length_s: 30, stride_length_s: 5 },
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
 * On WASM we run everything at fp32. Counter-intuitively, q4 is SLOWER
 * than fp32 on WASM for Whisper-base-sized models.
 *
 * INT8 dtypes (`q8`, `int8`, `uint8`) are also unusable on WASM for a
 * separate reason — see huggingface/transformers.js#1635.
 * If #1635 ever closes, q8 on WASM is worth re-benchmarking.
 *
 * The distil-whisper repos don't ship the dtypes WebGPU needs
 * (huggingface/transformers.js#1317), so they stay on WASM at q8.
 */
const DTYPE_BY_DEVICE: Record<WhisperModel, { wasm: DType; webgpu: DType | null }> = {
  'tiny':             { wasm: 'fp32', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'base':             { wasm: 'fp32', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'small':            { wasm: 'fp32', webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  'distil-small.en':  { wasm: 'q8', webgpu: null },
  'distil-medium.en': { wasm: 'q8', webgpu: null },
};

type WhisperChunk = { text: string; timestamp: [number | null, number | null] };
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
 * Progress reporting is real-only: the loading stage tracks model weight
 * download from HuggingFace; the inferring stage emits a single boundary
 * event when inference begins, since the underlying pipeline exposes no
 * usable per-chunk hook in v4.
 */
export class WhisperTranscriber implements Transcriber {
  private readonly model: WhisperModel;
  private readonly device: WhisperDevice;
  private pipelinePromise: ReturnType<typeof pipeline> | null = null;

  constructor(
    private readonly decoder: AudioDecoder,
    { model = 'base', device = 'auto' }: WhisperTranscriberConfig = {},
  ) {
    this.model = model;
    this.device = device;
    env.allowLocalModels = false;
  }

  onProgress?: (event: TranscriberProgressEvent) => void;

  async transcribe(audio: Blob, options?: TranscriberOptions): Promise<Document> {
    const transcriber = await this.loadPipeline();
    const pcm = await this.decoder.decode(audio, WHISPER_SAMPLE_RATE);
    this.onProgress?.({ stage: 'inferring' });

    console.time('whisper.inference');
    const result = (await (transcriber as CallableFunction)(
      pcm,
      this.buildPipelineOptions(options),
    )) as WhisperResult;
    console.timeEnd('whisper.inference');

    return this.buildDocument(result.chunks ?? []);
  }

  private loadPipeline(): ReturnType<typeof pipeline> {
    if (this.pipelinePromise === null) {
      this.pipelinePromise = (async () => {
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
    }
    return this.pipelinePromise;
  }

  private async resolveDevice(): Promise<ResolvedDevice> {
    const webgpuSupportedByModel = DTYPE_BY_DEVICE[this.model].webgpu !== null;
    if (this.device === 'wasm') return 'wasm';
    if (this.device === 'webgpu') {
      if (!webgpuSupportedByModel) {
        throw new Error(
          `Whisper model "${this.model}" does not support WebGPU; use 'wasm' or 'auto'.`,
        );
      }
      if (!(await this.isWebGPUAvailable())) {
        throw new Error(
          'WebGPU is not available in this browser. Ensure WebGPU is enabled and supported by your browser. Otherwise, switch to CPU in Advanced settings.',
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

  private buildPipelineOptions(options?: TranscriberOptions) {
    return {
      sampling_rate: WHISPER_SAMPLE_RATE,
      return_timestamps: 'word' as const,
      language: options?.language ?? null,
      task: 'transcribe' as const,
      ...CHUNK_CONFIG[this.model],
    };
  }

  private handleLoadProgress(data: LoadProgressEvent): void {
    if (data.status === AGGREGATE_LOAD_STATUS && data.progress !== undefined) {
      this.onProgress?.({
        stage: 'loading',
        progress: data.progress / 100,
      });
    }
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
