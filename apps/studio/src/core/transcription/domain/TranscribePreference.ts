import type { WhisperDevice, WhisperModel } from '@tscaps/engine';

export type TranscribeBackend = Extract<WhisperDevice, 'wasm' | 'webgpu'>;
export type TranscribeModel = Extract<WhisperModel, 'tiny' | 'base' | 'small'>;

/**
 * User-tunable transcription settings. `backend` chooses where Whisper
 * runs (CPU/WASM by default, WebGPU as opt-in); `model` picks the
 * multilingual Whisper variant. The engine's distil-whisper variants are
 * deliberately not surfaced here — they are English-only and WASM-only,
 * so exposing them would require conditional UX rules.
 */
export interface TranscribePreference {
  readonly backend: TranscribeBackend;
  readonly model: TranscribeModel;
}

export const DEFAULT_TRANSCRIBE_PREFERENCE: TranscribePreference = {
  backend: 'wasm',
  model: 'base',
};
