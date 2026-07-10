import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';

/** Persistence contract for the user's transcription settings. */
export interface TranscribePreferenceRepository {
  load(): TranscribePreference;
  save(pref: TranscribePreference): void;
}
