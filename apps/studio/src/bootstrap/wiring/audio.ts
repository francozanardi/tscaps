import { AudioPeakFolder } from '@core/audio/infrastructure/AudioPeakFolder';
import { MediaBunnyWaveformExtractor } from '@core/audio/infrastructure/MediaBunnyWaveformExtractor';
import { RememberingWaveformExtractor } from '@core/audio/infrastructure/RememberingWaveformExtractor';

export type AudioModule = ReturnType<typeof bootAudio>;

/**
 * Boots what more than one feature reads from a video's audio track: the
 * waveform, and the folding that produces it. One extractor serves them
 * all and remembers what it has worked out — including envelopes other
 * decodes leave with it — so a source's audio is folded once per session.
 */
export function bootAudio() {
  const peakFolder = new AudioPeakFolder();
  return {
    services: {
      peakFolder,
      waveformExtractor: new RememberingWaveformExtractor(new MediaBunnyWaveformExtractor(peakFolder)),
    },
  };
}
