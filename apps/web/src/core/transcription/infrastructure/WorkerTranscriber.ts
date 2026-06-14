import {
  Document,
  Section,
  Segment,
  Line,
  Word,
  TimeFragment,
  type AudioDecoder,
  type TranscriberOptions,
} from '@tscaps/engine';
import { AppError } from '@core/_shared/domain/AppError';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { LocalTranscriptionFailedError } from '@core/transcription/domain/errors/LocalTranscriptionFailedError';
import type { TranscribePhase } from '@core/transcription/domain/TranscribeStatus';
import type { TranscribeProgressStore } from '@core/transcription/store/TranscribeProgressStore';
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
 * consume those bytes through `PreDecodedAudioDecoder`.
 */
export class WorkerTranscriber implements ConfigurableTranscriber {
  readonly initialPhase: TranscribePhase = 'model-download';

  private currentJob: { resolve: (doc: Document) => void; reject: (err: Error) => void } | null = null;
  private config: unknown = null;

  constructor(
    private readonly worker: Worker,
    private readonly decoder: AudioDecoder,
    private readonly sampleRate: number,
    private readonly progress: TranscribeProgressStore,
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
    try {
      return await this.runTranscription(audio, options);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new LocalTranscriptionFailedError({ cause });
    }
  }

  private async runTranscription(audio: Blob, options?: TranscriberOptions): Promise<Document> {
    if (this.currentJob) {
      throw new Error('A transcription is already in progress');
    }
    const pcm = await this.decoder.decode(audio, this.sampleRate);
    const pcmBlob = new Blob([pcm.buffer as ArrayBuffer]);
    return new Promise<Document>((resolve, reject) => {
      this.currentJob = { resolve, reject };
      this.worker.postMessage({
        type: 'transcribe',
        audio: pcmBlob,
        options,
        transcriberConfig: this.config,
      });
    });
  }

  private readonly handleMessage = (event: MessageEvent<TranscriberWorkerOutbound>): void => {
    const data = event.data;
    if (data.type === 'progress') {
      const ev = data.event;
      if (ev.stage === 'loading') {
        this.progress.setModelDownloadProgress(ev.progress);
      } else {
        this.progress.enterInferringPhase();
      }
      return;
    }
    if (data.type === 'result') {
      const job = this.currentJob;
      this.currentJob = null;
      job?.resolve(this.buildDocument(data.words));
      return;
    }
    if (data.type === 'error') {
      const job = this.currentJob;
      this.currentJob = null;
      job?.reject(new LocalTranscriptionFailedError({ cause: new Error(data.message) }));
    }
  };

  private readonly handleError = (event: ErrorEvent): void => {
    console.error('[transcribe worker] uncaught error', event.message, event.filename + ':' + event.lineno, event.error);
    const job = this.currentJob;
    this.currentJob = null;
    job?.reject(new LocalTranscriptionFailedError({ cause: new Error(event.message || 'Worker error') }));
  };

  private buildDocument(serialized: SerializedWord[]): Document {
    const words = serialized.map((w) => new Word({ text: w.text, time: new TimeFragment(w.start, w.end) }));
    const segments = words.length === 0 ? [] : [new Segment({ lines: [new Line({ words })] })];
    return new Document({ sections: [new Section({ segments, kind: '' })] });
  }
}
