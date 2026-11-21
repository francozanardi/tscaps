import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';

/** Whether a video's file holds a sound this browser plays: still being found out, yes, or no. */
export type FootageSoundStatus = 'checking' | 'has-sound' | 'no-sound';

/**
 * Finds out, once per file, whether a video added to a shot has a sound
 * to hear, asked of the same files the soundtrack is read from: a file
 * with no audio track, one whose sound this browser cannot decode, or
 * one that cannot be had, has none. A file's bytes never change under
 * its id, so an answer is kept for as long as this lives.
 *
 * It never waits: a file not answered yet reads `checking` while its
 * check starts, and listeners hear when it lands.
 */
export class FootageSoundAvailability extends EventTarget {
  private readonly statuses = new Map<string, FootageSoundStatus>();

  constructor(private readonly files: AudioSourceFiles) {
    super();
  }

  /** Where the file `mediaId` stands; asking starts its check when it has none. */
  statusOf(mediaId: string): FootageSoundStatus {
    const known = this.statuses.get(mediaId);
    if (known !== undefined) return known;
    this.statuses.set(mediaId, 'checking');
    void this.files.load({ kind: 'media', mediaId }).then(
      (file) => this.land(mediaId, file === null ? 'no-sound' : 'has-sound'),
      () => this.land(mediaId, 'no-sound'),
    );
    return 'checking';
  }

  private land(mediaId: string, status: FootageSoundStatus): void {
    this.statuses.set(mediaId, status);
    this.dispatchEvent(new Event('change'));
  }
}
