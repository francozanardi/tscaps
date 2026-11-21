import { memo } from 'react';
import type { AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { FIELD_ROW_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface VideoSoundSectionProps {
  /** The video's own level, linear 0 to 2. */
  sourceVolume: number;
  presenter: AudioTabPresenter;
}

/** How loud the video's own sound is under everything added, up to twice as loud; at 0 it is muted. */
export const VideoSoundSection = memo(function VideoSoundSection({ sourceVolume, presenter }: VideoSoundSectionProps) {
  const { actions } = useAudioMix();
  const percent = presenter.percentOf(sourceVolume);
  return (
    <Section title="Video sound" titleAside={percent === 0 && <StatusPill label={presenter.mutedBadge()} />}>
      <div className={FIELD_ROW_CLASS}>
        <Slider label="Volume" value={percent} min={0} max={200} step={1} unit="%"
          onChange={(value) => actions.setSourceVolume.execute(presenter.gainOf(value))} />
      </div>
    </Section>
  );
});
