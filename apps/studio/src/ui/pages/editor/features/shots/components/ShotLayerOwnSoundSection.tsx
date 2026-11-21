import { memo, useMemo } from 'react';
import { DisabledReason } from '@ui/_shared/components/controls/fields/DisabledReason';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useFootageSoundPresenter } from '@ui/pages/editor/features/audio/hooks/useFootageSoundPresenter';
import { useFootageSoundStatuses } from '@ui/pages/editor/features/audio/hooks/useFootageSoundStatuses';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotLayerOwnSoundSectionProps {
  /** One b-roll, or several edited together; every one shows a video. Never empty. */
  layerIds: readonly string[];
}

/**
 * How loud a b-roll plays its file's own sound over the video's: 0, the
 * default, keeps it silent. Once it is heard, the video's own sound can
 * be turned off for the shots the b-rolls are on: their video volume,
 * which a shot's Sound tab sets, at 0, and back at full.
 *
 * A video whose file holds no sound this browser plays has nothing to
 * turn up: the slider is locked at 0, and says why when reached for.
 */
export const ShotLayerOwnSoundSection = memo(function ShotLayerOwnSoundSection({ layerIds }: ShotLayerOwnSoundSectionProps) {
  const { actions } = useAudioMix();
  const audio = useEditorAudioMix();
  const { shots } = useEditorState();
  const presenter = useFootageSoundPresenter();
  const mediaIds = useMemo(() => presenter.mediaIdsOf(layerIds, shots), [presenter, layerIds, shots]);
  const statuses = useFootageSoundStatuses(mediaIds);
  const sound = useMemo(() => presenter.footageSound(audio, layerIds), [presenter, audio, layerIds]);
  const shotIds = useMemo(() => presenter.shotIdsHolding(layerIds, shots), [presenter, layerIds, shots]);
  const video = useMemo(() => presenter.shotVideoVolume(audio, shotIds, shots), [presenter, audio, shotIds, shots]);
  const silent = statuses.length > 0 && statuses.every((status) => status === 'no-sound');
  const noSoundReason = silent ? (layerIds.length > 1 ? 'These videos have no sound.' : 'This video has no sound.') : null;
  return (
    <Section title="B-roll sound">
      <div className={FIELD_ROWS_CLASS}>
        <div className={FIELD_ROW_CLASS}>
          <DisabledReason reason={noSoundReason}>
            <Slider
              label="Volume"
              value={silent ? 0 : sound.volumePercent}
              min={0}
              max={200}
              step={1}
              unit="%"
              disabled={silent}
              mixed={!silent && sound.isVolumeMixed}
              onChange={(percent) => actions.setFootageSound.execute(layerIds, presenter.gainOf(percent))}
            />
          </DisabledReason>
        </div>
        {sound.isHeard && !silent && (
          <div className={FIELD_ROW_CLASS}>
            <Toggle
              label={shotIds.length > 1 ? 'Mute the video in these shots' : 'Mute the video in this shot'}
              value={video.isMuted}
              mixed={video.isMutedMixed}
              onChange={(on) => actions.setShotVideoVolume.execute(shotIds, on ? 0 : 1)}
            />
          </div>
        )}
      </div>
    </Section>
  );
});
