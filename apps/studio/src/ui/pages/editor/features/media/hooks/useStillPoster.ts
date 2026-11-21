import { useEffect, useMemo, useState } from 'react';
import { StillPosterSampler } from '@presentation/media/services/StillPosterSampler';

/** A still-poster sampler for the caller's lifetime. */
export function useStillPosterSampler(): StillPosterSampler {
  return useMemo(() => new StillPosterSampler(), []);
}

/**
 * A small poster of the picture `source`, or null until it is made and
 * while there is no source. A picture that cannot be read leaves it
 * null: the tile reads well enough with its type mark alone.
 */
export function useStillPoster(sampler: StillPosterSampler, source: Blob | null, widthPx: number | null): string | null {
  const [poster, setPoster] = useState<string | null>(null);
  useEffect(() => {
    if (!source) {
      setPoster(null);
      return;
    }
    let current = true;
    sampler.posterOf(source, widthPx)
      .then((made) => { if (current) setPoster(made); })
      .catch(() => { if (current) setPoster(null); });
    return () => { current = false; };
  }, [sampler, source, widthPx]);
  return poster;
}
