import { memo, useMemo } from 'react';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useFootageSoundPresenter } from '@ui/pages/editor/features/audio/hooks/useFootageSoundPresenter';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotVideoSoundSectionProps {
  shotId: string;
}

const NOTE_CLASS = 'm-0 text-2xs text-fg-faint leading-snug';

/**
 * How loud the video's own sound is during a shot, up to twice as loud,
 * on top of the video's volume in the Audio tab. At 0 the shot is
 * silent but for what was added over it: music, sound effects and its
 * b-rolls' own sound.
 */
export const ShotVideoSoundSection = memo(function ShotVideoSoundSection({ shotId }: ShotVideoSoundSectionProps) {
  const { actions } = useAudioMix();
  const audio = useEditorAudioMix();
  const { shots } = useEditorState();
  const presenter = useFootageSoundPresenter();
  const video = useMemo(() => presenter.shotVideoVolume(audio, [shotId], shots), [presenter, audio, shotId, shots]);
  return (
    <Section title="Video sound" titleAside={video.isMuted && <StatusPill label="Muted" />}>
      <div className={FIELD_ROWS_CLASS}>
        <div className={FIELD_ROW_CLASS}>
          <Slider
            label="Volume"
            value={video.volumePercent}
            min={0}
            max={200}
            step={1}
            unit="%"
            onChange={(percent) => actions.setShotVideoVolume.execute([shotId], presenter.gainOf(percent))}
          />
        </div>
        {video.isMuted && <p className={NOTE_CLASS}>Music, sound effects and b-roll sound still play.</p>}
      </div>
    </Section>
  );
});
