import { memo } from 'react';
import { MoreHorizontal, Music, Plus, Replace } from 'lucide-react';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipPatch } from '@core/audio-mix/domain/AudioClipPatch';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { MediaAssetTileLabels } from '@presentation/media/services/MediaAssetTileLabels';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { EMPTY_LINE_CLASS, FIGURE_CLASS, ROW_ICON_BUTTON_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { AudioClipMenu } from '@ui/pages/editor/features/audio/components/AudioClipMenu';
import { MusicWaveformStrip } from '@ui/pages/editor/features/audio/components/MusicWaveformStrip';
import { SoundPickerPopover } from '@ui/pages/editor/features/audio/components/SoundPickerPopover';
import { useMusicWaveform } from '@ui/pages/editor/features/audio/hooks/useMusicWaveform';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface MusicSectionProps {
  /** The project's music; null where it has none. */
  music: AudioClip | null;
  media: MediaAssetCatalog;
  presenter: AudioTabPresenter;
  projectId: string | null;
}

const LABELS = new MediaAssetTileLabels();
const MAX_FADE_SEC = 10;
const MAX_LOWERING_DB = 40;

/**
 * The song under the whole video. With none, one line and the button
 * that picks one from the user's files. With one, its file, where in it
 * playing starts, and how it plays: its level, its fades, whether it
 * starts over at its end, and whether, and how far, it is lowered
 * while somebody speaks. Its menu changes the file or removes it.
 */
export const MusicSection = memo(function MusicSection({ music, media, presenter, projectId }: MusicSectionProps) {
  const { actions } = useAudioMix();
  const useAsMusic = (source: AudioSourceRef) => { actions.useAsMusic.execute(source, 'audio-tab'); };

  if (music === null) {
    return (
      <Section title="Music">
        <p className={EMPTY_LINE_CLASS}>{presenter.musicEmptyLine()}</p>
        <SoundPickerPopover
          mode="music"
          projectId={projectId}
          pickLabel="Use"
          onPick={useAsMusic}
          trigger={<button type="button" className={`${BTN_SECONDARY_SM} self-start`}><Plus size={14} /> Add music</button>}
        />
      </Section>
    );
  }

  return (
    <Section
      title="Music"
      titleAside={(
        <AudioClipMenu
          mode="music"
          projectId={projectId}
          changeLabel="Change music"
          changeIcon={<Replace size={13} />}
          onChange={useAsMusic}
          onRemove={() => actions.removeClips.execute([music.id])}
          trigger={<button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label="Music options"><MoreHorizontal size={14} /></button>}
        />
      )}
    >
      <MusicSettings music={music} media={media} presenter={presenter} projectId={projectId} />
    </Section>
  );
});

interface MusicSettingsProps {
  music: AudioClip;
  media: MediaAssetCatalog;
  presenter: AudioTabPresenter;
  projectId: string | null;
}

function MusicSettings({ music, media, presenter, projectId }: MusicSettingsProps) {
  const { actions } = useAudioMix();
  const mediaId = music.source.kind === 'media' ? music.source.mediaId : null;
  const file = mediaId === null ? null : media.get(mediaId);
  const bars = useMusicWaveform(projectId, file === null ? null : mediaId);
  const length = file === null ? null : LABELS.durationOf(file);
  const patch = (fields: AudioClipPatch) => actions.patchClips.execute([music.id], fields);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Music size={14} className="shrink-0 text-fg-muted" />
        <span className="flex-1 min-w-0 truncate text-xs text-fg-primary" title={presenter.soundNameOf(music.source, media)}>
          {presenter.soundNameOf(music.source, media)}
        </span>
        {length !== null && <span className={FIGURE_CLASS}>{length}</span>}
      </div>
      {file !== null && file.durationSec !== null && file.durationSec > 0 && (
        <div className="flex flex-col gap-1">
          <MusicWaveformStrip
            bars={bars}
            inSec={music.inSec}
            lengthSec={file.durationSec}
            presenter={presenter}
            onInPointChange={(inSec) => patch({ inSec })}
          />
          <p className="m-0 text-3xs text-fg-muted tabular-nums">{presenter.inPointLabel(music.inSec)}</p>
        </div>
      )}
      <div className={FIELD_ROWS_CLASS}>
        <div className={FIELD_ROW_CLASS}>
          <Slider label="Volume" value={presenter.percentOf(music.volume)} min={0} max={200} step={1} unit="%"
            onChange={(percent) => patch({ volume: presenter.gainOf(percent) })} />
        </div>
        <div className={FIELD_ROW_CLASS}>
          <Slider label="Fade in" value={music.fadeInSec} min={0} max={MAX_FADE_SEC} step={0.1} unit="s"
            onChange={(fadeInSec) => patch({ fadeInSec })} />
        </div>
        <div className={FIELD_ROW_CLASS}>
          <Slider label="Fade out" value={music.fadeOutSec} min={0} max={MAX_FADE_SEC} step={0.1} unit="s"
            onChange={(fadeOutSec) => patch({ fadeOutSec })} />
        </div>
        <div className={FIELD_ROW_CLASS}>
          <Toggle label="Loop" value={music.loop} onChange={(loop) => patch({ loop })} />
        </div>
        <div className={FIELD_ROW_CLASS}>
          <Toggle label="Lower under speech" value={music.ducking.enabled} onChange={(enabled) => patch({ ducking: { enabled } })} />
        </div>
        {music.ducking.enabled && (
          <div className={FIELD_ROW_CLASS}>
            <Slider label="Lower by" value={presenter.loweringOf(music.ducking.depthDb)} min={0} max={MAX_LOWERING_DB} step={1} unit="dB"
              onChange={(lowering) => patch({ ducking: { depthDb: presenter.depthOf(lowering) } })} />
          </div>
        )}
      </div>
    </div>
  );
}
