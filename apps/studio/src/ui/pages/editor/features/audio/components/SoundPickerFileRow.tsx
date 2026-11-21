import { memo } from 'react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { SoundPickerPresenter } from '@presentation/audio-mix/services/SoundPickerPresenter';
import { MediaAssetTileLabels } from '@presentation/media/services/MediaAssetTileLabels';
import type { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { FIGURE_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { SoundPickerEntry } from '@ui/pages/editor/features/audio/components/SoundPickerEntry';
import { WaveformPoster } from '@ui/pages/editor/features/media/components/WaveformPoster';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { useMediaAssetWaveform } from '@ui/pages/editor/features/media/hooks/useMediaAssetWaveform';

interface SoundPickerFileRowProps {
  file: MediaAsset;
  projectId: string | null;
  waveformSampler: WaveformPosterSampler;
  presenter: SoundPickerPresenter;
  isPlaying: boolean;
  pickLabel: string;
  onAudition: () => void;
  onPick: () => void;
}

const LABELS = new MediaAssetTileLabels();
const POSTER_CLASS = 'w-12 h-8 shrink-0 rounded-xs bg-surface-1 overflow-hidden';

/**
 * One of the user's audio files in the picker: its waveform, and its
 * name over its length, pressed to hear it. One that cannot play here,
 * or is not here, says so in place of its pick button.
 */
export const SoundPickerFileRow = memo(function SoundPickerFileRow(props: SoundPickerFileRowProps) {
  const { file, projectId, waveformSampler, presenter, isPlaying, pickLabel, onAudition, onPick } = props;
  const bars = useMediaAssetWaveform(file, projectId, waveformSampler);
  const status = useMediaAssetStatusView(file.id);
  const pickable = presenter.canPick(status.state);
  const name = LABELS.nameOf(file);
  const length = LABELS.durationOf(file);
  return (
    <SoundPickerEntry
      name={name}
      isPlaying={isPlaying}
      pickLabel={pickLabel}
      onAudition={onAudition}
      onPick={pickable ? onPick : null}
      status={status.badge !== null && <StatusPill label={status.badge} tone="danger" />}
    >
      <span className={POSTER_CLASS}>{bars !== null && <WaveformPoster bars={bars} className="w-full h-full" />}</span>
      <span className="flex flex-col flex-1 min-w-0 py-2">
        <span className="truncate text-xs text-fg-primary" title={name}>{name}</span>
        {length !== null && <span className={FIGURE_CLASS}>{length}</span>}
      </span>
    </SoundPickerEntry>
  );
});
