import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LocalStorageTranscribePreferenceRepository } from '@core/transcription/infrastructure/repositories/LocalStorageTranscribePreferenceRepository';
import type { AudioDecoder } from '@tscaps/engine';
import { WHISPER_SAMPLE_RATE } from '@tscaps/engine/advanced';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { WorkerTranscriber } from '@core/transcription/infrastructure/WorkerTranscriber';
import { QueueingTranscriber } from '@core/transcription/infrastructure/QueueingTranscriber';
import { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';
import { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import { UpdateTranscribePreferenceAction } from '@core/transcription/actions/UpdateTranscribePreferenceAction';
import { UntranscribedRegionsStore } from '@core/transcription/store/UntranscribedRegionsStore';
import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import { SkippedCueBlocksStore } from '@core/transcription/store/SkippedCueBlocksStore';
import { ReadSubtitleFileAction } from '@core/transcription/actions/ReadSubtitleFileAction';
import { EngineSubtitleFileReader } from '@core/transcription/infrastructure/EngineSubtitleFileReader';
import { FormatPickingSubtitleFileReader } from '@core/transcription/infrastructure/FormatPickingSubtitleFileReader';
import { JsonWordTimingsSubtitleFileReader } from '@core/transcription/infrastructure/JsonWordTimingsSubtitleFileReader';
import { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { AudioModule } from '@bootstrap/wiring/audio';

export interface TranscriptionDependencies {
  readonly store: EditorStore;
  readonly preferenceRepository: LocalStorageTranscribePreferenceRepository;
  readonly audioDecoder: AudioDecoder;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly telemetry: TelemetryModule;
  readonly appNoticeChannel: AppNoticeChannel;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly storageFootprintProbe: StorageFootprintProbe;
  readonly audio: AudioModule;
  /** External transcriber; when omitted, picks the surface default. */
  readonly transcriber?: ConfigurableTranscriber;
}

export type TranscriptionModule = ReturnType<typeof bootTranscription>;

/**
 * Boots the transcription feature: the concrete transcriber and the
 * actions that consume it. The progress store is owned by the
 * preprocessing module and passed in — transcription is one phase of
 * preprocessing, so the broader-scoped store lives there.
 */
export function bootTranscription(deps: TranscriptionDependencies) {
  const transcriber = deps.transcriber ?? buildLocalTranscriber(deps);

  const untranscribedRegionsStore = new UntranscribedRegionsStore();
  const skippedCueBlocksStore = new SkippedCueBlocksStore();

  return {
    untranscribedRegionsStore,
    skippedCueBlocksStore,
    actions: {
      transcribe: new TranscribeAction(
        transcriber,
        new WordOverlapClamper(),
        deps.telemetry.telemetry,
      ),
      readSubtitleFile: new ReadSubtitleFileAction(
        new FormatPickingSubtitleFileReader(
          new JsonWordTimingsSubtitleFileReader(skippedCueBlocksStore),
          new EngineSubtitleFileReader(skippedCueBlocksStore),
        ),
        new WordOverlapClamper(),
      ),
      updatePreference: new UpdateTranscribePreferenceAction(deps.store, deps.preferenceRepository),
    },
  };
}


function buildLocalTranscriber(deps: TranscriptionDependencies): ConfigurableTranscriber {
  const worker = new Worker(
    new URL('../../core/transcription/infrastructure/workers/whisperWorker.ts', import.meta.url),
    { type: 'module' },
  );
  deps.workerErrorMonitor.monitor(worker, 'whisper-worker');
  // One model in one worker transcribes one video at a time; a video
  // started while another transcribes waits its turn.
  return new QueueingTranscriber(new WorkerTranscriber(
    worker,
    deps.audioDecoder,
    WHISPER_SAMPLE_RATE,
    new NonBlockingFailureReporter(
      deps.telemetry.telemetry,
      deps.appNoticeChannel,
      deps.errorClassifier,
      deps.errorTelemetryDescriber,
      deps.storageFootprintProbe,
      'transcription_model_cache_failed',
    ),
    deps.telemetry.telemetry,
    deps.audio.services.peakFolder,
    deps.audio.services.waveformExtractor,
  ));
}

