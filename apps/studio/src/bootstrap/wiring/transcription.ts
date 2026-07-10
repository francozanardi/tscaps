import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LocalStorageTranscribePreferenceRepository } from '@core/transcription/infrastructure/repositories/LocalStorageTranscribePreferenceRepository';
import type { AudioDecoder } from '@tscaps/engine';
import { WHISPER_SAMPLE_RATE } from '@tscaps/engine';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { WorkerTranscriber } from '@core/transcription/infrastructure/WorkerTranscriber';
import { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';
import { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import { UpdateTranscribePreferenceAction } from '@core/transcription/actions/UpdateTranscribePreferenceAction';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';

export interface TranscriptionDependencies {
  readonly store: EditorStore;
  readonly preferenceRepository: LocalStorageTranscribePreferenceRepository;
  readonly audioDecoder: AudioDecoder;
  readonly progressStore: PreprocessingProgressStore;
}

export type TranscriptionModule = ReturnType<typeof bootTranscription>;

/**
 * Boots the transcription feature: the concrete transcriber and the
 * actions that consume it. The progress store is owned by the
 * preprocessing module and passed in — transcription is one phase of
 * preprocessing, so the broader-scoped store lives there.
 */
export function bootTranscription(deps: TranscriptionDependencies) {
  const transcriber = buildLocalTranscriber(deps.progressStore, deps.audioDecoder);

  return {
    actions: {
      transcribe: new TranscribeAction(
        transcriber,
        deps.progressStore,
        new WordOverlapClamper(),
      ),
      updatePreference: new UpdateTranscribePreferenceAction(deps.store, deps.preferenceRepository),
    },
  };
}


function buildLocalTranscriber(
  progressStore: PreprocessingProgressStore,
  audioDecoder: AudioDecoder,
): ConfigurableTranscriber {
  return new WorkerTranscriber(
    new Worker(
      new URL('../../core/transcription/infrastructure/workers/whisperWorker.ts', import.meta.url),
      { type: 'module' },
    ),
    audioDecoder,
    WHISPER_SAMPLE_RATE,
    progressStore,
  );
}

