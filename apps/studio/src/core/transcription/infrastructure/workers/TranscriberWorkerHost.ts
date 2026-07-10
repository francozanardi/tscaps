import type { Transcriber, TranscriberOptions, TranscriberProgressEvent } from '@tscaps/engine';

export interface SerializedWord {
  text: string;
  start: number;
  end: number;
}

export type TranscriberWorkerInbound = {
  type: 'transcribe';
  audio: Blob;
  options?: TranscriberOptions;
  transcriberConfig?: unknown;
};

export type TranscriberWorkerOutbound =
  | { type: 'progress'; event: TranscriberProgressEvent }
  | { type: 'result'; words: SerializedWord[] }
  | { type: 'error'; message: string };

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

  private readonly handleMessage = (event: MessageEvent<TranscriberWorkerInbound>): void => {
    const data = event.data;
    if (data.type !== 'transcribe') return;
    const transcriber = this.resolveTranscriber(data.transcriberConfig);
    void this.run(transcriber, data.audio, data.options);
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
    try {
      const document = await transcriber.transcribe(audio, options);
      const words = document.getWords().map((w) => ({
        text: w.text,
        start: w.time.start,
        end: w.time.end,
      }));
      this.post({ type: 'result', words });
    } catch (err) {
      // Log here so the stack survives — postMessage strips it to a string.
      console.error('[transcribe worker] transcription failed', err);
      const message = err instanceof Error ? err.message : 'Transcription failed';
      this.post({ type: 'error', message });
    }
  }

  private post(message: TranscriberWorkerOutbound): void {
    (self as unknown as Worker).postMessage(message);
  }
}
