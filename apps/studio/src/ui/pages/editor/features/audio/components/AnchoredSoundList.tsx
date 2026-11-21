import { memo, useMemo } from 'react';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { AnchoredSoundRow } from '@ui/pages/editor/features/audio/components/AnchoredSoundRow';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useClipAudition } from '@ui/pages/editor/features/audio/hooks/useClipAudition';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

interface AnchoredSoundListProps {
  /** What the sounds listed are on. */
  anchor: AudioAnchor;
  /** Whether each row offers its nudge; on unless said otherwise. */
  nudges?: boolean;
}

/** Every sound effect on one anchor, one row each, in the order they were added; nothing where there is none. */
export const AnchoredSoundList = memo(function AnchoredSoundList({ anchor, nudges = true }: AnchoredSoundListProps) {
  const mix = useEditorAudioMix();
  const media = useMediaAssets();
  const presenter = useAnchoredSoundsPresenter();
  const sounds = useMemo(() => presenter.soundsOn(mix, anchor, media), [presenter, mix, anchor, media]);
  const clips = useMemo(() => sounds.map((sound) => sound.clip), [sounds]);
  const audition = useClipAudition(clips);
  if (sounds.length === 0) return null;
  return (
    <ul className="m-0 p-0 list-none flex flex-col" aria-label="Sounds">
      {sounds.map((sound) => (
        <AnchoredSoundRow
          key={sound.clip.id}
          sound={sound}
          presenter={presenter}
          isPlaying={audition.isPlaying(sound.clip)}
          onAudition={() => audition.toggle(sound.clip)}
          nudges={nudges}
        />
      ))}
    </ul>
  );
});
