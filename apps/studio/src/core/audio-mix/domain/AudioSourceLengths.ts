import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/** How long the file a clip names runs. */
export interface AudioSourceLengths {
  /** In seconds; null where the file, or its length, is not known. */
  lengthOf(source: AudioSourceRef): number | null;
}
