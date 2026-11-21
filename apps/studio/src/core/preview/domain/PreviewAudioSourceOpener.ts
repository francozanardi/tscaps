import type { PreviewAudioSource } from '@core/preview/domain/PreviewAudioSource';

/** Opens an audio file for a preview to play. */
export interface PreviewAudioSourceOpener {
  /**
   * The file's sound, decoded at `sampleRate` where it is decoded ahead.
   * Rejects when no decoder here can read it.
   */
  open(file: Blob, sampleRate: number): Promise<PreviewAudioSource>;
}
