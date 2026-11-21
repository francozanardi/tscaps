import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';
import { useMediaAssetProxy } from '@ui/pages/editor/features/media/hooks/useMediaAssetProxy';
import { useWaveformPoster } from '@ui/pages/editor/features/media/hooks/useWaveformPoster';

/**
 * The waveform poster of an audio file once it is ready, drawn from its
 * original; null before that, and always for any other kind of file.
 */
export function useMediaAssetWaveform(asset: MediaAsset, projectId: string | null, sampler: WaveformPosterSampler): readonly number[] | null {
  const isAudio = asset.type === 'audio';
  const preview = useMediaAssetProxy(projectId, isAudio ? asset.id : null);
  return useWaveformPoster(sampler, isAudio ? preview : null);
}
