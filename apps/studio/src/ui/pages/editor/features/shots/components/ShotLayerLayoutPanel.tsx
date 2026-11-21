import { RotateCcw } from 'lucide-react';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useElementInspectorTabNav } from '@ui/pages/editor/features/element/ElementInspectorTabNavContext';
import type { InspectedShotLayer } from '@ui/pages/editor/features/element/useInspectedElement';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { useRetryMediaAsset } from '@ui/pages/editor/features/media/hooks/useRetryMediaAsset';
import { CameraCropNotice } from '@ui/pages/editor/features/shots/camera/CameraCropNotice';
import { ShotLayerPlacementEditor } from '@ui/pages/editor/features/shots/components/ShotLayerPlacementEditor';
import { ShotLayerTimingSection } from '@ui/pages/editor/features/shots/components/ShotLayerTimingSection';
import { useShotLayerPoster } from '@ui/pages/editor/features/shots/hooks/useShotLayerPoster';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { useShotLayerPlacementForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerPlacementForm';
import { useShotLayerRole } from '@ui/pages/editor/features/shots/hooks/useShotLayerRole';
import { useShotLayerTakeover } from '@ui/pages/editor/features/shots/hooks/useShotLayerTakeover';

interface ShotLayerLayoutPanelProps {
  element: InspectedShotLayer;
}

const RETRY_CLASS =
  'shrink-0 inline-flex items-center gap-2 h-7 px-3 rounded-xs bg-surface-2 border border-edge-medium '
  + 'text-2xs text-fg-secondary cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:border-edge-strong hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

// The shortest stretch the sliders leave between the two ends, so the
// end can never be dragged onto the start.
const MIN_STRETCH_SEC = 0.1;

/**
 * How a shot layer sits in the frame and, for a video, which part of
 * its file it plays: *Layout*, *Box*, *Style*, then *Timing*. The file
 * itself — its name, its poster, replacing it, removing the layer — is
 * the header's; a word on where the file stands leads the panel only
 * while there is something to say. Draws no scroll of its own: it is
 * one page of the inspector, which scrolls it.
 *
 * A picture, a GIF or a graphic has no timing to set: it spans the shots
 * it shows on.
 */
export function ShotLayerLayoutPanel({ element }: ShotLayerLayoutPanelProps) {
  const { layer } = element;
  const mediaId = 'mediaId' in layer ? layer.mediaId : null;
  const role = useShotLayerRole(mediaId);
  return (
    <div className="flex flex-col">
      {mediaId !== null && <ShotLayerFileStatus mediaId={mediaId} />}
      {/* A layer whose file is gone has no known kind to lay out: it can only be removed. */}
      {(role !== null || mediaId === null) && <ShotLayerLayoutSections element={element} filesAreVideos={role === 'video'} />}
      {'mediaId' in layer && element.media?.type === 'video' && element.media.durationSec !== null && (
        <ShotLayerTiming layer={layer} durationSec={element.media.durationSec} />
      )}
    </div>
  );
}

/** Where the layer's file stands, with a way to try again where that could help; nothing once it is ready. */
function ShotLayerFileStatus({ mediaId }: { mediaId: string }) {
  const retry = useRetryMediaAsset();
  const view = useMediaAssetStatusView(mediaId);
  if (view.note === null) return null;
  return (
    <div className="flex items-center gap-2 pb-4">
      <p className={`m-0 flex-1 min-w-0 text-2xs leading-snug ${view.tone === 'alert' ? 'text-danger' : 'text-fg-muted'}`}>
        {view.note}
      </p>
      {view.retryable && (
        <button type="button" className={RETRY_CLASS} onClick={() => retry(mediaId)}>
          <RotateCcw size={13} /> Try again
        </button>
      )}
    </div>
  );
}

interface ShotLayerLayoutSectionsProps extends ShotLayerLayoutPanelProps {
  /** Whether the layer's file is a video, the only kind offered a background around it. */
  filesAreVideos: boolean;
}

/**
 * How the layer sits in the frame: its own layout, which moves no other
 * layer; a field its CSS took over is dimmed. A layer whose file is at
 * hand is cropped on a frame of it.
 */
function ShotLayerLayoutSections({ element, filesAreVideos }: ShotLayerLayoutSectionsProps) {
  return element.media === null
    ? <ShotLayerLayoutEditor element={element} filesAreVideos={filesAreVideos} poster={undefined} />
    : <ShotLayerLayoutEditorOnFile element={element} media={element.media} filesAreVideos={filesAreVideos} />;
}

/** The layout of a layer whose file is at hand, with a frame of the file to crop it on. */
function ShotLayerLayoutEditorOnFile({ element, media, filesAreVideos }: ShotLayerLayoutSectionsProps & { media: MediaAsset }) {
  const poster = useShotLayerPoster(media);
  return <ShotLayerLayoutEditor element={element} filesAreVideos={filesAreVideos} poster={poster} />;
}

function ShotLayerLayoutEditor({ element, filesAreVideos, poster }: ShotLayerLayoutSectionsProps & { poster: string | null | undefined }) {
  const { actions } = useShots();
  const { frameLayout, shots } = useEditorState();
  const form = useShotLayerPlacementForm();
  const frameAspectRatio = frameLayout ? frameLayout.width / frameLayout.height : null;
  const isGraphic = 'graphic' in element.layer;
  const assetAspectRatio = 'graphic' in element.layer
    ? element.layer.graphic.aspectRatio
    : element.media ? form.aspectRatioOf(element.media.widthPx, element.media.heightPx) : null;
  const takeover = useShotLayerTakeover(shots.layerStyles.get(element.layer.id));
  return (
    <ShotLayerPlacementEditor
      placement={shots.placementOf(element.layer.id)}
      frameAspectRatio={frameAspectRatio}
      assetAspectRatio={assetAspectRatio}
      takenOver={takeover.layoutFields}
      filesAreVideos={filesAreVideos}
      isGraphic={isGraphic}
      poster={isGraphic ? undefined : poster}
      cropNotice={(axis) => <ShotLayerCameraCropNotice layerId={element.layer.id} axis={axis} />}
      onChange={(placement) => actions.setLayerPlacement.execute(element.layer.id, placement)}
    />
  );
}

/**
 * Says so when the layer's camera keeps a position of its own on the
 * axis its file is cropped on, where the crop picked above does not
 * move it: with a way to give that axis back to the crop, unless the
 * camera pans along it, and a way to open the Camera tab.
 */
function ShotLayerCameraCropNotice({ layerId, axis }: { layerId: string; axis: 'x' | 'y' }) {
  const { actions } = useShots();
  const { shots } = useEditorState();
  const form = useShotLayerMotionForm();
  const { show } = useElementInspectorTabNav();
  const style = shots.layerStyles.get(layerId);
  const camera = form.cameraOf(style?.fields, style?.animations?.[ElementAnimationScope.CAMERA]);
  if (!camera.holdsOwnShare(axis)) return null;
  const travels = axis === 'x' && camera.pans;
  return (
    <CameraCropNotice
      message={travels
        ? 'The camera pans across the whole file, so this position is not used.'
        : 'The camera uses its own position, not this one.'}
      onFollow={travels ? undefined : () => actions.setCamera.followFrame({ kind: 'layer', layerId }, axis)}
      onEditCamera={() => show('camera')}
    />
  );
}

/** Which part of its file the layer plays, each change written to this layer alone. */
function ShotLayerTiming({ layer, durationSec }: { layer: ShotFileLayer; durationSec: number }) {
  const { actions } = useShots();
  const endSec = layer.outSec ?? durationSec;
  const setTiming = (inSec: number, outSec: number | null, loop: boolean) => actions.setLayerTiming.execute(layer.id, {
    inSec,
    // The file's own end is stored as no end at all, so a file that
    // turns out longer than measured still plays to its end.
    outSec: outSec === null || outSec >= durationSec ? null : outSec,
    loop,
  });
  return (
    <ShotLayerTimingSection
      inSec={layer.inSec}
      outSec={layer.outSec}
      loop={layer.loop}
      durationSec={durationSec}
      onStartChange={(inSec) => setTiming(inSec, Math.max(endSec, inSec + MIN_STRETCH_SEC), layer.loop)}
      onEndChange={(outSec) => setTiming(layer.inSec, outSec, layer.loop)}
      onLoopChange={(loop) => setTiming(layer.inSec, layer.outSec, loop)}
    />
  );
}
