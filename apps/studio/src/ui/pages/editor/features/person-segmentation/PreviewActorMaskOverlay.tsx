import { useEffect, useRef } from 'react';
import { PreviewActorMaskOverlayController } from '@presentation/person-segmentation/controllers/PreviewActorMaskOverlayController';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

/**
 * Mounts the actor-cutout canvas that occludes captions with the
 * segmenter's mask during preview playback. Meant for the subtitle
 * overlay's occlusion slot: the parent element is the caption
 * coordinate space (and the gating DOM root), while the preview
 * canvas to sample is found by walking up to the nearest ancestor
 * that contains one. The mount is gated on the shared
 * preview-support checker so sessions that cannot sample the preview
 * canvas do not spin up the overlay. Templates whose effect depends
 * on this path are filtered out of the picker upstream, but the
 * guard remains as a defensive backstop.
 *
 * The canvas is `pointer-events: none` and paints above the caption
 * layers so its pixels visually replace whatever text the actor
 * overlaps.
 */
export function PreviewActorMaskOverlay() {
  const personSegmentation = usePersonSegmentation();
  const editor = useEditor();
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlaySupported = personSegmentation.previewSupportChecker.isSupported();

  useEffect(() => {
    if (!overlaySupported) return;
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas === null) return;
    const segmentDomRoot = overlayCanvas.parentElement;
    if (segmentDomRoot === null) return;
    const previewCanvas = findPreviewCanvas(overlayCanvas);
    if (previewCanvas === null) return;
    const controller = new PreviewActorMaskOverlayController(
      previewCanvas,
      overlayCanvas,
      segmentDomRoot,
      editor.store,
      personSegmentation.loadedCacheStore,
    );
    controller.start();
    return () => controller.stop();
  }, [overlaySupported, editor.store, personSegmentation.loadedCacheStore]);

  if (!overlaySupported) return null;
  return (
    <canvas
      ref={overlayCanvasRef}
      data-actor-mask-overlay
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

/**
 * Walks up from the overlay canvas and returns the preview canvas of
 * the nearest ancestor that contains one, or `null` when no ancestor
 * does. The walk stops at the first hit, so it resolves the video box
 * that hosts this overlay and never a canvas elsewhere on the page.
 */
function findPreviewCanvas(overlayCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
  for (let ancestor = overlayCanvas.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const candidate = ancestor.querySelector('canvas:not([data-actor-mask-overlay])');
    if (candidate instanceof HTMLCanvasElement) return candidate;
  }
  return null;
}
