import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LocalStorageTranscribePreferenceRepository } from '@core/transcription/infrastructure/repositories/LocalStorageTranscribePreferenceRepository';
import type { AudioDecoder } from '@tscaps/engine';
import { WHISPER_SAMPLE_RATE } from '@tscaps/engine';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { WorkerTranscriber } from '@core/transcription/infrastructure/WorkerTranscriber';
import { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';
import { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import { UpdateTranscribePreferenceAction } from '@core/transcription/actions/UpdateTranscribePreferenceAction';
import { TranscribeProgressStore } from '@core/transcription/store/TranscribeProgressStore';

export interface TranscriptionDependencies {
  readonly store: EditorStore;
  readonly preferenceRepository: LocalStorageTranscribePreferenceRepository;
  readonly audioDecoder: AudioDecoder;
}

export type TranscriptionModule = ReturnType<typeof bootTranscription>;

/**
 * Boots the transcription feature: the raw progress store, the
 * concrete transcriber, and the actions that consume them. The
 * progress smoothing controller lives in the editor host.
 *
 * Transcription is one phase of the preprocessing pipeline — the
 * orchestrator that chains transcription with subsequent steps and
 * the derived "should the start dialog be open?" flow store both
 * live in the preprocessing module.
 */
export function bootTranscription(deps: TranscriptionDependencies) {
  const progressStore = new TranscribeProgressStore();
  const transcriber = buildLocalTranscriber(progressStore, deps.audioDecoder);

  return {
    progressStore,
    actions: {
      transcribe: new TranscribeAction(
        transcriber,
        progressStore,
        new WordOverlapClamper(),
      ),
      updatePreference: new UpdateTranscribePreferenceAction(deps.store, deps.preferenceRepository),
    },
  };
}


function buildLocalTranscriber(
  progressStore: TranscribeProgressStore,
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

