import { useMemo } from 'react';
import { AnchoredSoundsPresenter } from '@presentation/audio-mix/services/AnchoredSoundsPresenter';
import { AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';
import { SoundNames } from '@presentation/audio-mix/services/SoundNames';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';

/** What a sound looks like beside what it is on: a word, a shot's edge, a layer's. */
export function useAnchoredSoundsPresenter(): AnchoredSoundsPresenter {
  const { services } = useAudioMix();
  return useMemo(() => new AnchoredSoundsPresenter(new SoundNames(services.builtinSounds), new AudioOffsetNudge()), [services]);
}
