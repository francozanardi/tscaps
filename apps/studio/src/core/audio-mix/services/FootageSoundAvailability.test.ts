import { describe, expect, it, vi } from 'vitest';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { FootageSoundAvailability } from '@core/audio-mix/services/FootageSoundAvailability';

/** Whether a b-roll's file has a sound to hear, found out once and told to listeners. */

class CountingFiles implements AudioSourceFiles {
  readonly reads: string[] = [];

  load(source: AudioSourceRef): Promise<Blob | null> {
    if (source.kind !== 'media') return Promise.resolve(null);
    this.reads.push(source.mediaId);
    return source.mediaId === 'silent' ? Promise.resolve(null) : Promise.resolve(new Blob([source.mediaId]));
  }
}

describe('a b-roll\'s sound', () => {
  it('reads checking at first, then whether the file has a sound, telling listeners', async () => {
    const files = new CountingFiles();
    const availability = new FootageSoundAvailability(files);
    const changed = vi.fn();
    availability.addEventListener('change', changed);

    expect(availability.statusOf('voice')).toBe('checking');
    expect(availability.statusOf('silent')).toBe('checking');
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));

    expect(availability.statusOf('voice')).toBe('has-sound');
    expect(availability.statusOf('silent')).toBe('no-sound');
    expect(files.reads).toEqual(['voice', 'silent']);
  });
});
