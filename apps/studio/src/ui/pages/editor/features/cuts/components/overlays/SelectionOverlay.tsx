import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CutsSelection } from '@presentation/cuts/controllers/CutsEditingController';
import { useCutsEditingController } from '@ui/pages/editor/features/cuts/contexts/CutsEditingContext';
import { percentage } from '@ui/pages/editor/features/cuts/utils';

const SELECTION_OVERLAY_CLASS = 'bg-accent/25 border border-accent/60 rounded-xs';

const RESIZE_HANDLE_CLASS = 'pointer-events-auto absolute top-0 bottom-0 w-2 -mx-1 cursor-ew-resize';

interface SelectionOverlayProps {
  selection: CutsSelection;
  segmentStartSec: number;
  segmentDurationSec: number;
}

/**
 * Translucent rectangle marking the drag-selected range inside a
 * segment's timeline. Carries left and right edge handles that resize
 * the selection: each handle anchors the opposite edge and routes the
 * pointer through the editing controller's edge-drag so the parent
 * row's existing pointer-move/up handlers continue the gesture.
 */
export function SelectionOverlay({ selection, segmentStartSec, segmentDurationSec }: SelectionOverlayProps) {
  const controller = useCutsEditingController();
  const leftPct = percentage(selection.startSec - segmentStartSec, segmentDurationSec);
  const widthPct = percentage(selection.endSec - selection.startSec, segmentDurationSec);

  const startResizeFromAnchor = (anchorSec: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    controller.startEdgeDrag(selection.segmentId, anchorSec);
  };

  return (
    <div
      className={SELECTION_OVERLAY_CLASS}
      style={{ position: 'absolute', left: leftPct, width: widthPct, top: 0, bottom: 0 }}
    >
      <div
        className={RESIZE_HANDLE_CLASS}
        style={{ left: 0 }}
        title="Drag to resize selection"
        aria-label="Resize selection start"
        onPointerDown={startResizeFromAnchor(selection.endSec)}
      />
      <div
        className={RESIZE_HANDLE_CLASS}
        style={{ right: 0 }}
        title="Drag to resize selection"
        aria-label="Resize selection end"
        onPointerDown={startResizeFromAnchor(selection.startSec)}
      />
    </div>
  );
}
