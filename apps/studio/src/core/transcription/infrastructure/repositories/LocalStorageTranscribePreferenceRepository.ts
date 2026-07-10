import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import {
  DEFAULT_TRANSCRIBE_PREFERENCE,
  type TranscribeBackend,
  type TranscribeModel,
  type TranscribePreference,
} from '@core/transcription/domain/TranscribePreference';
import type { TranscribePreferenceRepository } from '@core/transcription/domain/TranscribePreferenceRepository';

const KEY = 'transcribe-preference';

const VALID_BACKENDS: ReadonlySet<TranscribeBackend> = new Set(['wasm', 'webgpu']);
const VALID_MODELS: ReadonlySet<TranscribeModel> = new Set(['tiny', 'base', 'small']);

/**
 * localStorage-backed implementation. Reads validate each field against
 * the current allowed values, so a stale or corrupted entry (e.g. a model
 * name we no longer ship) silently falls back to defaults rather than
 * producing an unusable preference.
 */
export class LocalStorageTranscribePreferenceRepository implements TranscribePreferenceRepository {

  constructor(
    private readonly storage: LocalStorageClient,
    private readonly defaultPreference: TranscribePreference = DEFAULT_TRANSCRIBE_PREFERENCE,
  ) {}

  load(): TranscribePreference {
    const raw = this.storage.get<Partial<TranscribePreference>>(KEY);
    if (!raw || typeof raw !== 'object') return this.defaultPreference;
    const backend = VALID_BACKENDS.has(raw.backend as TranscribeBackend)
      ? (raw.backend as TranscribeBackend)
      : this.defaultPreference.backend;
    const model = VALID_MODELS.has(raw.model as TranscribeModel)
      ? (raw.model as TranscribeModel)
      : this.defaultPreference.model;
    return { backend, model };
  }

  save(pref: TranscribePreference): void {
    this.storage.set(KEY, pref);
  }
}
