import { useMemo } from 'react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useMediaAssetPoster, type MediaAssetPosterSamplers } from '@ui/pages/editor/features/media/hooks/useMediaAssetPoster';
import { useStillPosterSampler } from '@ui/pages/editor/features/media/hooks/useStillPoster';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';

/**
 * The poster the media bin shows for a layer's file — a video's opening
 * frame, a picture, a GIF's first frame — as a URL, or null until it is
 * made.
 */
export function useShotLayerPoster(media: MediaAsset): string | null {
  const { projectId } = useEditorState();
  const videoSampler = useVideoFrameSampler();
  const stillSampler = useStillPosterSampler();
  const samplers = useMemo<MediaAssetPosterSamplers>(() => ({ video: videoSampler, still: stillSampler }), [videoSampler, stillSampler]);
  return useMediaAssetPoster(media, projectId, samplers);
}
