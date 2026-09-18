import {
  Document,
  Section,
  Segment,
  Line,
  Word,
  TimeFragment,
  type AudioDecoder,
  type TranscriberOptions,
  type UntranscribedRegion,
} from '@tscaps/engine';
import { AppError } from '@core/errors/domain/AppError';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { AudioExtractionFailedError } from '@core/transcription/domain/errors/AudioExtractionFailedError';
import { LocalTranscriptionFailedError } from '@core/transcription/domain/errors/LocalTranscriptionFailedError';
import { TranscriptionModelCacheFailedError } from '@core/transcription/domain/errors/TranscriptionModelCacheFailedError';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { WorkerBoundaryError } from '@core/_shared/workers/WorkerBoundaryError';
import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type {
  SerializedWord,
  TranscriberWorkerOutbound,
} from '@core/transcription/infrastructure/workers/TranscriberWorkerHost';

/**
 * Main-thread proxy around a Transcriber that lives inside an injected
 * Worker. The proxy stays generic — it has no knowledge of which concrete
 * transcriber lives inside the worker; adding a new one is a matter of
 * writing a new worker entry and pointing this proxy at it.
 *
 * Audio decoding happens on the main thread (Web Audio APIs are not
 * exposed to Worker contexts) through the supplied AudioDecoder; raw PCM
 * bytes then travel to the worker as a Blob. The worker is expected to
 * consume those bytes through `PreDecodedAudioDecoder`. Decode progress
 * is reported through the shared preprocessing progress store as the
 * `audio-extract` phase.
 *
 * A worker that reports it could not keep the assets it downloaded
 * gets that announced as a non-blocking notice. Nothing about the run
 * in flight changes: the assets are in memory and the cost lands on
 * the next session, which would otherwise discover it as an
 * unexplained download.
 */
export class WorkerTranscriber implements ConfigurableTranscriber {
  readonly initialPhase: PreprocessingProgressPhase = 'audio-extract';

  onUntranscribedRegion?: (region: UntranscribedRegion) => void;

  private currentJob: { resolve: (doc: Document) => void; reject: (err: Error) => void } | null = null;
  private config: unknown = null;

  constructor(
    private readonly worker: Worker,
    private readonly decoder: AudioDecoder,
    private readonly sampleRate: number,
    private readonly progress: PreprocessingProgressStore,
    private readonly modelCacheFailureReporter: NonBlockingFailureReporter,
    private readonly telemetry: Telemetry,
  ) {
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
    this.worker.addEventListener('messageerror', (e) => {
      console.error('[transcribe worker] messageerror', e);
    });
  }

  setConfig(config: unknown): void {
    this.config = config;
  }

  async transcribe(audio: Blob, options?: TranscriberOptions): Promise<Document> {
    if (this.currentJob) {
      throw new Error('A transcription is already in progress');
    }
    const pcm = await this.extractPcm(audio);
    try {
      return await this.runInference(pcm, options);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new LocalTranscriptionFailedError({ cause });
    }
  }

  private async extractPcm(audio: Blob): Promise<Float32Array> {
    this.progress.setAudioExtractProgress(0);
    try {
      return await this.decoder.decode(audio, this.sampleRate, (progress) => {
        this.progress.setAudioExtractProgress(progress);
      });
    } catch (cause) {
      throw new AudioExtractionFailedError({ cause });
    }
  }

  private runInference(pcm: Float32Array, options?: TranscriberOptions): Promise<Document> {
    // Transferring moves the whole buffer, and a decoder pre-sizes it
    // from an estimated duration, so the range it filled travels too.
    // The slack past that range is silence the model hallucinates on.
    const pcmBuffer = pcm.buffer as ArrayBuffer;
    return new Promise<Document>((resolve, reject) => {
      this.currentJob = { resolve, reject };
      this.worker.postMessage(
        {
          type: 'transcribe',
          audio: pcmBuffer,
          audioByteOffset: pcm.byteOffset,
          audioSampleCount: pcm.length,
          options,
          transcriberConfig: this.config,
        },
        [pcmBuffer],
      );
    });
  }

  private readonly handleMessage = (event: MessageEvent<TranscriberWorkerOutbound>): void => {
    const data = event.data;
    if (data.type === 'progress') {
      const ev = data.event;
      if (ev.stage === 'loading') {
        this.progress.setModelDownloadProgress(ev.progress);
      } else if (ev.progress !== undefined) {
        this.progress.setInferringProgress(ev.progress);
      } else {
        this.progress.enterInferringPhase();
      }
      return;
    }
    if (data.type === 'result') {
      const job = this.currentJob;
      this.currentJob = null;
      for (const region of data.untranscribedRegions) {
        this.onUntranscribedRegion?.({ startSeconds: region.start, endSeconds: region.end });
      }
      job?.resolve(this.buildDocument(data.words));
      return;
    }
    if (data.type === 'host-unreachable') {
      this.reportHostUnreachable(data);
      return;
    }
    if (data.type === 'assets-not-kept') {
      this.modelCacheFailureReporter.report(
        new TranscriptionModelCacheFailedError({ cause: new WorkerBoundaryError(data) }),
      );
      return;
    }
    if (data.type === 'error') {
      const job = this.currentJob;
      this.currentJob = null;
      job?.reject(this.failureFor(new WorkerBoundaryError(data)));
    }
  };

  private readonly handleError = (event: ErrorEvent): void => {
    console.error('[transcribe worker] uncaught error', event.message, event.filename + ':' + event.lineno, event.error);
    const job = this.currentJob;
    this.currentJob = null;
    job?.reject(this.failureFor(new Error(event.message || 'Worker error')));
  };

  /**
   * Counts a host the worker could not reach and took a second route
   * around. Telemetry only, and deliberately no notice: the run
   * recovers, so there is nothing for the reader to do or decide, and
   * a route is not a thing anyone chose.
   *
   * It is worth counting on its own because the run that recovers
   * looks identical to one that never had a problem, so without this
   * the condition is invisible until it stops being recoverable.
   */
  private reportHostUnreachable(description: { origin: string; name: string; message: string }): void {
    this.telemetry.capture('transcription_model_host_unreachable', {
      unreachable_host: description.origin,
      direct_failure_name: description.name,
      direct_failure_message: description.message,
    });
  }

  /**
   * Names the operation that failed. The proxy stays transcriber-
   * agnostic — every worker-side failure surfaces as a local-transcription
   * error, and the rendering boundary refines its wording from the cause
   * chain via the shared FailureReason rules.
   */
  private failureFor(cause: Error): AppError {
    return new LocalTranscriptionFailedError({ cause });
  }

  private buildDocument(serialized: SerializedWord[]): Document {
    const words = serialized.map((w) => new Word({ text: w.text, time: new TimeFragment(w.start, w.end) }));
    const segments = words.length === 0 ? [] : [new Segment({ lines: [new Line({ words })] })];
    return new Document({ sections: [new Section({ segments, kind: '' })] });
  }
}
