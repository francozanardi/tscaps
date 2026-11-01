import { useEffect, useState } from 'react';
import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type { VideoConversionOfferStore } from '@core/preprocessing/store/VideoConversionOfferStore';

/** The conversion offer waiting on the reader's answer, or `null`. Re-renders when it changes. */
export function useVideoConversionOffer(store: VideoConversionOfferStore): VideoConversionOffer | null {
  const [offer, setOffer] = useState<VideoConversionOffer | null>(() => store.offer);
  useEffect(() => {
    const update = () => setOffer(store.offer);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return offer;
}
