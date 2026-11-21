import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ShotsOnlyLayoutFollower } from '@core/shots/testing/ShotsOnlyLayoutFollower';
import { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import type { InsetShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import { ShotLayerManipulationController } from '@presentation/shots/controllers/ShotLayerManipulationController';
import { InsetLayerGestureGeometry } from '@presentation/shots/services/InsetLayerGestureGeometry';
import type { ShotLayerGesture } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import type { ShotLayerHitTarget } from '@presentation/shots/services/ShotLayerHitTargetResolver';

/**
 * Dragging a box over the video on the preview. The promise: a gesture
 * the layer's own CSS has taken over writes nothing and says so where
 * the pointer is, the press still picks the box, and a gesture it has
 * not taken over moves the box as ever.
 */

const FRAME = { left: 0, top: 0, width: 400, height: 800 } as DOMRect;
const INSET: InsetShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: 1, padding: 0, cornerRadius: 0, fit: 'cover',
};

function target(cssOwned: ReadonlyArray<ShotLayerGesture> = []): ShotLayerHitTarget {
  return {
    layerId: 'box',
    mediaId: 'file',
    kind: 'image',
    placement: INSET,
    rect: { x: 0.3, y: 0.4, width: 0.4, height: 0.2 },
    assetAspectRatio: 1,
    cssOwnedGestures: new Set(cssOwned),
  };
}

function pointer(type: string, clientX: number, clientY: number): PointerEvent {
  return Object.assign(new Event(type), { button: 0, pointerId: 1, clientX, clientY }) as unknown as PointerEvent;
}

function setUp() {
  const store = new EditorStore();
  const media = new MediaAssetStore();
  const telemetry = new RecordingShotTelemetry();
  const setPlacement = new SetShotLayerPlacementAction(
    store,
    new TestShotLayerLayouts().writer,
    new LastEditedPlacementRecorder(media, new ShotLayerAssetReader()),
    new ShotsOnlyLayoutFollower(),
    telemetry.layoutChanges,
    telemetry.edits,
  );
  const written = vi.spyOn(setPlacement, 'execute').mockImplementation(() => {});
  const selection = new OverlaySelectionController();
  const controller = new ShotLayerManipulationController(
    store,
    new InsetLayerGestureGeometry({ vertical: { center: 0.5, radius: 0.025 }, horizontal: { center: 0.5, radius: 0.02 } }),
    setPlacement,
    selection,
    new NextClickSuppressor(),
  );
  // The pointer travels to `x`, `y` and lets go there.
  const drag = (x: number, y: number) => {
    window.dispatchEvent(pointer('pointermove', x, y));
    window.dispatchEvent(pointer('pointerup', x, y));
  };
  return { controller, selection, written, drag };
}

describe('ShotLayerManipulationController', () => {
  beforeEach(() => { vi.stubGlobal('window', new EventTarget()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('moves a box whose CSS leaves its position to the panel', () => {
    const { controller, written, drag } = setUp();

    controller.startMove(target(), { frameRect: FRAME, event: pointer('pointerdown', 200, 400) });
    drag(240, 400);

    expect(written).toHaveBeenCalled();
    expect(controller.refusalSnapshot()).toBeNull();
  });

  it('picks a box whose CSS sets its position, moves nothing, and says so at the pointer', () => {
    const { controller, selection, written, drag } = setUp();

    controller.startMove(target(['move']), { frameRect: FRAME, event: pointer('pointerdown', 200, 400) });

    expect(selection.selectionSnapshot()).toEqual({ kind: 'shot-layer', layerId: 'box' });
    expect(controller.refusalSnapshot()).toEqual({ layerId: 'box', gesture: 'move', x: 0.5, y: 0.5 });
    drag(240, 400);
    expect(written).not.toHaveBeenCalled();
    expect(controller.snapshot()).toBeNull();
  });

  it('still resizes a box whose CSS sets only its position, and refuses the resize of one whose CSS sets its size', () => {
    const { controller, written, drag } = setUp();

    controller.startResize(target(['resize']), 'br', { frameRect: FRAME, event: pointer('pointerdown', 280, 480) });
    drag(320, 520);
    expect(written).not.toHaveBeenCalled();

    controller.startResize(target(['move']), 'br', { frameRect: FRAME, event: pointer('pointerdown', 280, 480) });
    drag(320, 520);
    expect(written).toHaveBeenCalled();
  });

  it('says so while the pointer rests on a gesture the CSS has taken, and stops once it leaves', () => {
    const { controller } = setUp();

    controller.pointAt(target(['move']), 'move', { frameRect: FRAME, clientX: 100, clientY: 200 });
    expect(controller.refusalSnapshot()).toEqual({ layerId: 'box', gesture: 'move', x: 0.25, y: 0.25 });

    controller.pointAt(target(['move']), 'resize', { frameRect: FRAME, clientX: 100, clientY: 200 });
    expect(controller.refusalSnapshot()).toBeNull();

    controller.pointAt(target(['move']), 'move', { frameRect: FRAME, clientX: 100, clientY: 200 });
    controller.pointerLeft('box', 'move');
    expect(controller.refusalSnapshot()).toBeNull();
  });

  it('refuses nothing while another box is being dragged over one whose CSS has taken the move', () => {
    const { controller } = setUp();

    controller.startMove(target(), { frameRect: FRAME, event: pointer('pointerdown', 200, 400) });
    controller.pointAt({ ...target(['move']), layerId: 'other' }, 'move', { frameRect: FRAME, clientX: 100, clientY: 200 });

    expect(controller.refusalSnapshot()).toBeNull();
  });
});
