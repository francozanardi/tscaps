import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';

/**
 * Low enough to keep the decoded copy small, high enough for every
 * browser's `OfflineAudioContext`: older Safari refuses a rate under it.
 */
const DECODE_SAMPLE_RATE = 22_050;

/**
 * {@link AudioPlaybackProbe} through the Web Audio API's
 * `decodeAudioData`, which reads some files a browser's WebCodecs will
 * not — Safari decodes FLAC only this way. It cannot decode part of a
 * file, so the whole file is decoded, resampled down to keep the copy
 * small (about 10 MB a minute of stereo), and dropped at once.
 *
 * Main thread only: `OfflineAudioContext` does not exist in workers.
 */
export class WebAudioAudioPlaybackProbe implements AudioPlaybackProbe {
  async ensurePlayable(audio: Blob): Promise<void> {
    const context = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
    const decoded = await context.decodeAudioData(await audio.arrayBuffer());
    if (decoded.length === 0) throw new Error('The file decoded to no sound');
  }
}
