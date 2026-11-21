import {
  Document,
  Section,
  Segment,
  Line,
  Word,
  TimeFragment,
  type AudioDecoder,
  type UntranscribedRegion,
} from '@tscaps/engine';
import { AppError } from '@core/errors/domain/AppError';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import type { TranscriptionRequest } from '@core/transcription/domain/TranscriptionRequest';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';
import { AudioExtractionFailedError } from '@core/transcription/domain/errors/AudioExtractionFailedError';
import { LocalTranscriptionFailedError } from '@core/transcription/domain/errors/LocalTranscriptionFailedError';
import { TranscriptionModelCacheFailedError } from '@core/transcription/domain/errors/TranscriptionModelCacheFailedError';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { WorkerBoundaryError } from '@core/_shared/workers/WorkerBoundaryError';
import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { WaveformMemory } from '@core/audio/domain/WaveformMemory';
import { WAVEFORM_PEAKS_PER_SECOND } from '@core/audio/domain/WaveformResolution';
import type { AudioPeakFolder } from '@core/audio/infrastructure/AudioPeakFolder';
import type {
  SerializedUntranscribedRegion,
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
 * consume those bytes through `PreDecodedAudioDecoder`. Each call
 * reports its progress to the requester's progress: the decode as the
 * `audio-extract` phase, then the model download and the inference the
 * worker reports. The call's config travels to the worker with it.
 *
 * One call at a time, decode included: a call made while another is in
 * flight is refused at once, so two calls never share the worker and
 * never take each other's result. Callers that may overlap queue in
 * front of it.
 *
 * A worker that reports it could not keep the assets it downloaded
 * gets that announced as a non-blocking notice. Nothing about the run
 * in flight changes: the assets are in memory and the cost lands on
 * the next session, which would otherwise discover it as an
 * unexplained download.
 */
export class WorkerTranscriber implements ConfigurableTranscriber {
  readonly initialPhase: PreprocessingProgressPhase = 'audio-extract';

  private busy = false;
  private currentJob: {
    resolve: (result: TranscriptionResult) => void;
    reject: (err: Error) => void;
    progress: PreprocessingProgressStore;
  } | null = null;

  constructor(
    private readonly worker: Worker,
    private readonly decoder: AudioDecoder,
    private readonly sampleRate: number,
    private readonly modelCacheFailureReporter: NonBlockingFailureReporter,
    private readonly telemetry: Telemetry,
    private readonly peakFolder: AudioPeakFolder,
    private readonly waveformMemory: WaveformMemory,
  ) {
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
    this.worker.addEventListener('messageerror', (e) => {
      console.error('[transcribe worker] messageerror', e);
    });
  }

  async transcribe(
    audio: Blob,
    requester: TranscriptionRequester,
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    if (this.busy) {
      throw new Error('A transcription is already in progress');
    }
    this.busy = true;
    try {
      const pcm = await this.extractPcm(audio, requester.progress);
      this.rememberWaveformOf(audio, pcm);
      return await this.runInference(pcm, requester.progress, request);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new LocalTranscriptionFailedError({ cause });
    } finally {
      this.busy = false;
    }
  }

  private async extractPcm(audio: Blob, progress: PreprocessingProgressStore): Promise<Float32Array> {
    progress.setAudioExtractProgress(0);
    try {
      return await this.decoder.decode(audio, this.sampleRate, (fraction) => {
        progress.setAudioExtractProgress(fraction);
      });
    } catch (cause) {
      throw new AudioExtractionFailedError({ cause });
    }
  }

  /**
   * Leaves the envelope of the audio just decoded for whoever asks for
   * this source's waveform next, so it is not decoded a second time. Must
   * run before inference, which hands the PCM's buffer to the worker.
   */
  private rememberWaveformOf(audio: Blob, pcm: Float32Array): void {
    const peaks = this.peakFolder.ofPcm(pcm, this.sampleRate, WAVEFORM_PEAKS_PER_SECOND);
    this.waveformMemory.remember(audio, WAVEFORM_PEAKS_PER_SECOND, peaks);
  }

  private runInference(
    pcm: Float32Array,
    progress: PreprocessingProgressStore,
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    // Transferring moves the whole buffer, and a decoder pre-sizes it
    // from an estimated duration, so the range it filled travels too.
    // The slack past that range is silence the model hallucinates on.
    const pcmBuffer = pcm.buffer as ArrayBuffer;
    return new Promise<TranscriptionResult>((resolve, reject) => {
      this.currentJob = { resolve, reject, progress };
      this.worker.postMessage(
        {
          type: 'transcribe',
          audio: pcmBuffer,
          audioByteOffset: pcm.byteOffset,
          audioSampleCount: pcm.length,
          options: request.options,
          transcriberConfig: request.config,
        },
        [pcmBuffer],
      );
    });
  }

  private readonly handleMessage = (event: MessageEvent<TranscriberWorkerOutbound>): void => {
    const data = event.data;
    if (data.type === 'progress') {
      const progress = this.currentJob?.progress;
      if (!progress) return;
      const ev = data.event;
      if (ev.stage === 'loading') {
        progress.setModelDownloadProgress(ev.progress);
      } else if (ev.progress !== undefined) {
        progress.setInferringProgress(ev.progress);
      } else {
        progress.enterInferringPhase();
      }
      return;
    }
    if (data.type === 'result') {
      const job = this.currentJob;
      this.currentJob = null;
      // Dev only: what the model said, before anything downstream touched
      // it, for comparing against audio whose timing is known.
      if (import.meta.env.DEV) window.__tscapsModelWords = data.words;
      job?.resolve({
        document: this.buildDocument(data.words),
        untranscribedRegions: data.untranscribedRegions.map((region) => this.regionOf(region)),
      });
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

  private regionOf(serialized: SerializedUntranscribedRegion): UntranscribedRegion {
    return { startSeconds: serialized.start, endSeconds: serialized.end };
  }

  private buildDocument(serialized: SerializedWord[]): Document {
    const words = serialized.map((w) => new Word({ text: w.text, time: new TimeFragment(w.start, w.end) }));
    const segments = words.length === 0 ? [] : [new Segment({ lines: [new Line({ words })] })];
    return new Document({ sections: [new Section({ segments, kind: '' })] });
  }
}
