import { useMemo } from 'react';
import { FootageSoundPresenter } from '@presentation/audio-mix/services/FootageSoundPresenter';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What a b-roll's own sound and a shot's video sound look like where they are switched. */
export function useFootageSoundPresenter(): FootageSoundPresenter {
  const { layerAssets } = useShots().services;
  return useMemo(() => new FootageSoundPresenter(layerAssets), [layerAssets]);
}
