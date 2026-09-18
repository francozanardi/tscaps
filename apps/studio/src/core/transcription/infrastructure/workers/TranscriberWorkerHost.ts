import type { Transcriber, TranscriberOptions, TranscriberProgressEvent } from '@tscaps/engine';
import { WorkerBoundaryError, type WorkerErrorDescription } from '@core/_shared/workers/WorkerBoundaryError';

export interface SerializedWord {
  text: string;
  start: number;
  end: number;
}

export interface SerializedUntranscribedRegion {
  start: number;
  end: number;
}

/**
 * A transcription request. `audio` is the transferred backing buffer
 * of a mono PCM `Float32Array`; the byte offset and sample count
 * delimit the part that holds audio, since a decoder may hand back a
 * view of a larger buffer it pre-sized.
 */
export type TranscriberWorkerInbound = {
  type: 'transcribe';
  audio: ArrayBuffer;
  audioByteOffset: number;
  audioSampleCount: number;
  options?: TranscriberOptions;
  transcriberConfig?: unknown;
};

export type TranscriberWorkerOutbound =
  | { type: 'progress'; event: TranscriberProgressEvent }
  | { type: 'result'; words: SerializedWord[]; untranscribedRegions: SerializedUntranscribedRegion[] }
  | ({ type: 'assets-not-kept' } & WorkerErrorDescription)
  | ({ type: 'host-unreachable'; origin: string } & WorkerErrorDescription)
  | ({ type: 'error' } & WorkerErrorDescription);

/**
 * Worker-side counterpart of `WorkerTranscriber`. Receives transcription
 * requests via postMessage, builds a concrete Transcriber from the
 * supplied config, and ships progress and results back.
 *
 * Config travels with every request, so callers can change the inner
 * transcriber's settings (e.g. model, device) between calls without
 * tearing down the worker. The host keeps the last-built instance and
 * only rebuilds when the config differs.
 *
 * Outdated instances are dropped for GC. transformers.js holds an ONNX
 * session inside the pipeline that has no public disposal hook, so
 * memory release is best-effort; this is bounded in practice because
 * users rarely flip config more than once or twice per session.
 */
export class TranscriberWorkerHost {
  private currentTranscriber: Transcriber | null = null;
  private currentConfigKey: string | null = null;

  constructor(private readonly factory: (config: unknown) => Transcriber) {}

  start(): void {
    self.addEventListener('message', this.handleMessage);
  }

  /**
   * Tells the owner that the transcriber could not keep the assets it
   * downloaded, so the next session will download them again. Says
   * nothing about the run in flight, which is unaffected and may not
   * even exist yet.
   */
  reportAssetsNotKept(error: unknown): void {
    this.post({ type: 'assets-not-kept', ...WorkerBoundaryError.describe(error, 'Downloaded assets were not kept') });
  }

  /**
   * Tells the owner that a host the transcriber downloads from could
   * not be reached, and that a second route was taken instead. The run
   * is unaffected and may not even exist yet: what this reports is the
   * route, not an outcome.
   */
  reportHostUnreachable(origin: string, error: unknown): void {
    this.post({
      type: 'host-unreachable',
      origin,
      ...WorkerBoundaryError.describe(error, `${origin} could not be reached`),
    });
  }

  private readonly handleMessage = (event: MessageEvent<TranscriberWorkerInbound>): void => {
    const data = event.data;
    if (data.type !== 'transcribe') return;
    const transcriber = this.resolveTranscriber(data.transcriberConfig);
    const pcm = new Float32Array(data.audio, data.audioByteOffset, data.audioSampleCount);
    void this.run(transcriber, new Blob([pcm]), data.options);
  };

  private resolveTranscriber(config: unknown): Transcriber {
    const key = JSON.stringify(config ?? null);
    if (this.currentTranscriber !== null && this.currentConfigKey === key) {
      return this.currentTranscriber;
    }
    const next = this.factory(config);
    next.onProgress = (event) => this.post({ type: 'progress', event });
    this.currentTranscriber = next;
    this.currentConfigKey = key;
    return next;
  }

  private async run(
    transcriber: Transcriber,
    audio: Blob,
    options?: TranscriberOptions,
  ): Promise<void> {
    // Rebound on every request so a previous run's regions never leak
    // into the next result.
    const untranscribedRegions: SerializedUntranscribedRegion[] = [];
    transcriber.onUntranscribedRegion = (region) =>
      untranscribedRegions.push({ start: region.startSeconds, end: region.endSeconds });
    try {
      const document = await transcriber.transcribe(audio, options);
      const words = document.getWords().map((w) => ({
        text: w.text,
        start: w.time.start,
        end: w.time.end,
      }));
      this.post({ type: 'result', words, untranscribedRegions });
    } catch (err) {
      // Log here so the stack survives — postMessage strips it to a string.
      console.error('[transcribe worker] transcription failed', err);
      this.post({ type: 'error', ...WorkerBoundaryError.describe(err, 'Transcription failed') });
    }
  }

  private post(message: TranscriberWorkerOutbound): void {
    (self as unknown as Worker).postMessage(message);
  }
}
