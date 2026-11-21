import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { StillPosterSampler } from '@presentation/media/services/StillPosterSampler';
import type { VideoFrameSampler } from '@presentation/shots/services/VideoFrameSampler';
import { useMediaAssetProxy } from '@ui/pages/editor/features/media/hooks/useMediaAssetProxy';
import { useStillPoster } from '@ui/pages/editor/features/media/hooks/useStillPoster';
import { useShotPoster } from '@ui/pages/editor/features/shots/hooks/useShotPoster';

/** What each kind of file's poster is taken with. */
export interface MediaAssetPosterSamplers {
  readonly video: VideoFrameSampler;
  readonly still: StillPosterSampler;
}

/**
 * The picture poster of a media file once it is ready: a video's
 * opening frame, a picture made small, a GIF's first frame. Null before
 * that, and always for an audio file, whose poster is its waveform.
 */
export function useMediaAssetPoster(asset: MediaAsset, projectId: string | null, samplers: MediaAssetPosterSamplers): string | null {
  const isVideo = asset.type === 'video';
  const isStill = asset.type === 'image' || asset.type === 'gif';
  const preview = useMediaAssetProxy(projectId, asset.id);
  const videoPoster = useShotPoster(samplers.video, isVideo ? preview : null, 0);
  const stillPoster = useStillPoster(samplers.still, isStill ? preview : null, asset.widthPx);
  return isVideo ? videoPoster : stillPoster;
}
