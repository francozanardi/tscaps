import { useMemo } from 'react';
import { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';
import { useMediaAssetProxy } from '@ui/pages/editor/features/media/hooks/useMediaAssetProxy';
import { useWaveformPoster } from '@ui/pages/editor/features/media/hooks/useWaveformPoster';

// Fine enough to place an in-point by eye along a sidebar's width.
const STRIP_BAR_COUNT = 96;

/** The bars of a whole audio file's waveform strip, once the file is ready and read; null before that and for no file. */
export function useMusicWaveform(projectId: string | null, mediaId: string | null): readonly number[] | null {
  const { waveforms } = useMedia();
  const sampler = useMemo(() => new WaveformPosterSampler(waveforms, STRIP_BAR_COUNT), [waveforms]);
  const file = useMediaAssetProxy(projectId, mediaId);
  return useWaveformPoster(sampler, file);
}
