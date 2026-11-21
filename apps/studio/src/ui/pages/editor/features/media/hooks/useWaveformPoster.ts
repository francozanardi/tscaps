import { useEffect, useMemo, useState } from 'react';
import { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';

/** A waveform-poster sampler for the caller's lifetime, reading through the media module's waveforms. */
export function useWaveformPosterSampler(): WaveformPosterSampler {
  const { waveforms } = useMedia();
  return useMemo(() => new WaveformPosterSampler(waveforms), [waveforms]);
}

/**
 * The bars of the audio file `source`'s poster, or null until they are
 * made and while there is no source. A file that cannot be read, or has
 * no sound that decodes here, leaves it null: the tile reads well enough
 * with its type mark alone.
 */
export function useWaveformPoster(sampler: WaveformPosterSampler, source: Blob | null): readonly number[] | null {
  const [bars, setBars] = useState<readonly number[] | null>(null);
  useEffect(() => {
    if (!source) {
      setBars(null);
      return;
    }
    let current = true;
    sampler.barsOf(source)
      .then((made) => { if (current) setBars(made.length === 0 ? null : made); })
      .catch(() => { if (current) setBars(null); });
    return () => { current = false; };
  }, [sampler, source]);
  return bars;
}
