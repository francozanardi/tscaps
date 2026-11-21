import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, type InputAudioTrack } from 'mediabunny';
import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';

/** How much of the sound is decoded to tell that the rest will decode too. */
const PROBED_SEC = 1;

/**
 * {@link AudioPlaybackProbe} through mediabunny: reads the primary audio
 * track out of its container and decodes its first second through
 * WebCodecs (or mediabunny's own PCM decoder). Streams the samples and
 * closes each at once, so nothing decoded is kept whatever the file's
 * length. Rejects for a file with no audio track, a codec this browser
 * will not decode, and a decode that fails or yields no sound.
 */
export class MediaBunnyAudioPlaybackProbe implements AudioPlaybackProbe {
  async ensurePlayable(audio: Blob): Promise<void> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(audio) });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) throw new Error('The file holds no audio track');
      if (!(await track.canDecode())) throw new Error(`This browser cannot decode ${track.codec ?? 'an unknown'} audio`);
      await this.decodeStartOf(track);
    } finally {
      input.dispose();
    }
  }

  private async decodeStartOf(track: InputAudioTrack): Promise<void> {
    const start = await track.getFirstTimestamp();
    let decoded = 0;
    for await (const sample of new AudioSampleSink(track).samples(start, start + PROBED_SEC)) {
      decoded += sample.numberOfFrames;
      sample.close();
    }
    if (decoded === 0) throw new Error('The first second of the file decoded to no sound');
  }
}
