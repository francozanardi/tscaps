import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { TranscribePreferenceRepository } from '@core/transcription/domain/TranscribePreferenceRepository';

/**
 * Mutates and persists the user's transcription preference in lockstep:
 * the store update lets the dialog re-render against the new value; the
 * repository write keeps the setting across sessions.
 */
export class UpdateTranscribePreferenceAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: TranscribePreferenceRepository,
  ) {}

  execute(pref: TranscribePreference): void {
    this.store.setTranscribePreference(pref);
    this.repository.save(pref);
  }
}
