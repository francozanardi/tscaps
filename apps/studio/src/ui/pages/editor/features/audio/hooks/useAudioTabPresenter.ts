import { useMemo } from 'react';
import { AudioAnchorLabels } from '@presentation/audio-mix/services/AudioAnchorLabels';
import { AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';
import { AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { SoundNames } from '@presentation/audio-mix/services/SoundNames';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What the Audio tab shows and says, reading anchors the way the preview and the export place them. */
export function useAudioTabPresenter(): AudioTabPresenter {
  const { services } = useAudioMix();
  const { layerAssets } = useShots().services;
  return useMemo(
    () => new AudioTabPresenter(
      services.timing,
      new AudioAnchorLabels(layerAssets, new ShotLayerLabels()),
      new SoundNames(services.builtinSounds),
      new AudioOffsetNudge(),
    ),
    [services, layerAssets],
  );
}
