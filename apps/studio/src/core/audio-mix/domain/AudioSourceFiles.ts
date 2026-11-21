import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/** Where the file a clip names is read from, to be heard. */
export interface AudioSourceFiles {
  /**
   * The file, or null where it cannot be had: its bytes are gone or
   * unreadable, or this browser cannot decode it. Never rejects for
   * those; it may wait as long as the file takes to come down.
   */
  load(source: AudioSourceRef): Promise<Blob | null>;
}
