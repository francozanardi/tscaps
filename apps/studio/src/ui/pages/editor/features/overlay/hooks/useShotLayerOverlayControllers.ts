import { useEffect, useMemo } from 'react';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import { ShotLayerHitTargetController } from '@presentation/shots/controllers/ShotLayerHitTargetController';
import { ShotLayerManipulationController } from '@presentation/shots/controllers/ShotLayerManipulationController';
import { ShotLayerPickPlaybackController } from '@presentation/shots/controllers/ShotLayerPickPlaybackController';
import { ShotLayerShortcutCommands } from '@presentation/shots/controllers/ShotLayerShortcutCommands';
import { InsetLayerGestureGeometry } from '@presentation/shots/services/InsetLayerGestureGeometry';
import { ShotLayerCssOwnedGestureReader } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import { ShotLayerHitTargetResolver } from '@presentation/shots/services/ShotLayerHitTargetResolver';
import { ShotLayerTakeoverReader } from '@presentation/shots/services/ShotLayerTakeoverReader';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useShortcut } from '@ui/_shared/hooks/useShortcut';
import type { ShotLayerOverlay } from '@ui/pages/editor/features/overlay/contexts/ShotLayerOverlayContext';

/**
 * Builds and runs what makes shot layers things the preview can pick:
 * the hit targets laid over the boxes on screen, the drags that move
 * and resize them, Delete taking the picked one off its shot, and the
 * pause that keeps a picked layer's panel open. Everything stops with
 * the editor.
 */
export function useShotLayerOverlayControllers(
  store: EditorStore,
  selection: OverlaySelectionController,
  pause: () => void,
): ShotLayerOverlay {
  const { services, actions } = useShots();
  const media = useMedia();
  const { styledElementCatalog, cssControlledFieldFinder, animationCssWriter } = useElements().services;
  const cssOwnedGestures = useMemo(() => new ShotLayerCssOwnedGestureReader(new ShotLayerTakeoverReader(
    cssControlledFieldFinder,
    styledElementCatalog.controlsFor('layer'),
    animationCssWriter,
    services.cssParser,
  )), [cssControlledFieldFinder, styledElementCatalog, animationCssWriter, services]);
  const hitTargets = useMemo(
    () => new ShotLayerHitTargetController(
      store,
      services.layerTiming,
      new ShotLayerHitTargetResolver(),
      services.previewFootage,
      media.assets,
      media.preparer,
      selection,
      cssOwnedGestures,
    ),
    [store, services, media, selection, cssOwnedGestures],
  );
  const manipulation = useMemo(() => {
    const snap = new SnapZoneResolver();
    const gestures = new InsetLayerGestureGeometry({
      vertical: snap.horizontalCenterBand(),
      horizontal: snap.verticalCenterBand(),
    });
    return new ShotLayerManipulationController(store, gestures, actions.setLayerPlacement, selection, new NextClickSuppressor());
  }, [store, services, actions, selection]);
  const shortcutCommands = useMemo(
    () => new ShotLayerShortcutCommands(selection, actions.removeLayers),
    [selection, actions],
  );
  const pickPlayback = useMemo(() => new ShotLayerPickPlaybackController(selection, pause), [selection, pause]);

  useEffect(() => {
    hitTargets.start();
    return () => hitTargets.stop();
  }, [hitTargets]);
  useEffect(() => () => manipulation.stop(), [manipulation]);
  useShortcut('editor.removePickedLayer', () => shortcutCommands.removePicked());
  useEffect(() => {
    pickPlayback.start();
    return () => pickPlayback.stop();
  }, [pickPlayback]);

  return useMemo(() => ({ hitTargets, manipulation }), [hitTargets, manipulation]);
}
