import { memo, useMemo } from 'react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { CameraPanel, type CameraPicture } from '@ui/pages/editor/features/shots/camera/CameraPanel';
import { useShotLayerPlacementForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerPlacementForm';
import { useShotLayerPoster } from '@ui/pages/editor/features/shots/hooks/useShotLayerPoster';

interface ShotLayerCameraPanelProps {
  layerId: string;
  /** The layer's file. */
  media: MediaAsset;
}

const CENTRED = { x: 0.5, y: 0.5 };
const NOTE_CLASS = 'm-0 text-xs text-fg-muted';

/**
 * What a layer's camera does with its picture inside its box — a split's
 * part, a floating box, the whole frame — which cuts it, so the box stays
 * where its layout puts it while the picture moves: picked on a frame of
 * the layer's file, the whole file where filling its box crops it, the
 * box as composed otherwise.
 */
export const ShotLayerCameraPanel = memo(function ShotLayerCameraPanel({ layerId, media }: ShotLayerCameraPanelProps) {
  const { shots, frameLayout, video } = useEditorState();
  const { services } = useShots();
  const catalog = useMediaAssets();
  const timeMap = useRenderTimeMap();
  const form = useShotLayerPlacementForm();
  const poster = useShotLayerPoster(media);
  const soundsPresenter = useAnchoredSoundsPresenter();
  const soundAnchor = useMemo(() => soundsPresenter.layerCameraAnchor(layerId), [soundsPresenter, layerId]);
  const target = useMemo(() => ({ kind: 'layer' as const, layerId }), [layerId]);
  const stretch = useMemo(
    () => services.layerTiming.scheduleAll(shots, catalog, timeMap, video.duration > 0 ? video.duration : null)
      .find((scheduled) => scheduled.layer.id === layerId)?.stretch ?? null,
    [services, shots, catalog, timeMap, video.duration, layerId],
  );
  const placement = shots.placementOf(layerId);
  const frameAspect = frameLayout !== null && frameLayout.height > 0 ? frameLayout.width / frameLayout.height : 16 / 9;
  const assetAspect = form.aspectRatioOf(media.widthPx, media.heightPx);
  const picture = useMemo<CameraPicture>(() => {
    const boxAspect = form.boxAspectRatioOf(placement, frameAspect, assetAspect) ?? assetAspect ?? frameAspect;
    const croppedAxis = form.croppedAxisOf(placement, frameAspect, assetAspect);
    if (croppedAxis === null || assetAspect === null) {
      const posterFit = placement.fit === 'cover' ? 'cover' as const : placement.backdrop === 'blur' ? 'contain-blur' as const : 'contain-black' as const;
      return { aspect: boxAspect, span: { x: 1, y: 1 }, posterFit };
    }
    const across = croppedAxis === 'x' ? assetAspect / boxAspect : boxAspect / assetAspect;
    return { aspect: assetAspect, span: croppedAxis === 'x' ? { x: across, y: 1 } : { x: 1, y: across }, posterFit: 'cover' };
  }, [form, placement, frameAspect, assetAspect]);
  if (stretch === null) return <p className={NOTE_CLASS}>This layer does not play: its shot is cut away.</p>;
  return (
    <CameraPanel
      target={target}
      styleId={layerId}
      soundAnchor={soundAnchor}
      outputStartSec={stretch.outputStartSec}
      outputEndSec={stretch.outputEndSec}
      poster={poster}
      picture={picture}
      frameShare={placement.position ?? CENTRED}
    />
  );
});
