import { useEffect, useMemo } from 'react';
import { SoundAuditionPlayer } from '@presentation/audio-mix/controllers/SoundAuditionPlayer';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';

/** A player of the caller's own, for its lifetime: whatever plays stops when the caller unmounts. */
export function useSoundAuditionPlayer(): SoundAuditionPlayer {
  const { services } = useAudioMix();
  const { bytes } = useMedia();
  const player = useMemo(
    () => new SoundAuditionPlayer(services.builtinSounds, bytes, services.auditionOutput),
    [services, bytes],
  );
  useEffect(() => () => player.stop(), [player]);
  return player;
}
