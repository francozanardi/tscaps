import { X } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import { useCutsEditingController } from '@ui/pages/editor/features/cuts/contexts/CutsEditingContext';
import { useCutsCutEdit } from '@ui/pages/editor/features/cuts/hooks/useCutsEditing';
import { percentage } from '@ui/pages/editor/features/cuts/utils';

const CUT_OVERLAY_CLASS =
  'pointer-events-auto border border-edge-medium rounded-xs '
  + 'backdrop-grayscale backdrop-brightness-[0.55]';

const CUT_OVERLAY_STYLE = {
  backgroundImage:
    'repeating-linear-gradient('
    + '135deg,'
    + 'rgb(var(--color-fg-faint) / 0.35) 0,'
    + 'rgb(var(--color-fg-faint) / 0.35) 4px,'
    + 'transparent 4px,'
    + 'transparent 9px'
    + ')',
} as const;

const CUT_RESTORE_BUTTON_CLASS =
  'pointer-events-auto inline-flex items-center justify-center w-4 h-4 rounded-xs ' +
  'bg-surface-3 border border-edge-medium text-fg-secondary cursor-pointer ' +
  'transition-colors duration-quick ease-standard hover:bg-surface-2 hover:border-accent hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent';

const CUT_RESIZE_HANDLE_CLASS = 'pointer-events-auto absolute top-0 bottom-0 w-2 -mx-1 cursor-ew-resize';

interface CutOverlayProps {
  cut: CutRange;
  segmentId: string;
  segmentStartSec: number;
  segmentDurationSec: number;
  onRestore: () => void;
}

/**
 * Diagonal-hatched mask drawn over the portion of a segment's timeline
 * that lives inside a cut range. Carries a restore button in the
 * top-right corner and edge handles that resize the cut: each handle
 * anchors the opposite edge of the stored cut and routes the pointer
 * through the editing controller's cut-edit so the parent row's
 * existing pointer-move/up handlers continue the gesture. While an
 * edit is in progress on this cut, the mask renders the live preview
 * range so the user can see the new size before releasing. Handles
 * only render on the side whose edge falls inside this segment's row,
 * so cuts that span multiple rows only expose the relevant handle in
 * each row.
 */
export function CutOverlay({ cut, segmentId, segmentStartSec, segmentDurationSec, onRestore }: CutOverlayProps) {
  const controller = useCutsEditingController();
  const cutEdit = useCutsCutEdit();
  const segmentEndSec = segmentStartSec + segmentDurationSec;
  const isBeingEdited = cutEdit !== null && cutEdit.originalRange === cut;
  const displayRange = isBeingEdited ? cutEdit.range : cut;

  const visibleStart = Math.max(displayRange.startSec, segmentStartSec);
  const visibleEnd = Math.min(displayRange.endSec, segmentEndSec);
  const leftPct = percentage(visibleStart - segmentStartSec, segmentDurationSec);
  const widthPct = percentage(visibleEnd - visibleStart, segmentDurationSec);

  const showLeftHandle = displayRange.startSec >= segmentStartSec && displayRange.startSec <= segmentEndSec;
  const showRightHandle = displayRange.endSec >= segmentStartSec && displayRange.endSec <= segmentEndSec;

  const startResizeFromAnchor = (anchorSec: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    controller.startCutEdit(segmentId, cut, anchorSec);
  };

  return (
    <div
      className={CUT_OVERLAY_CLASS}
      style={{ ...CUT_OVERLAY_STYLE, position: 'absolute', left: leftPct, width: widthPct, top: 0, bottom: 0 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showLeftHandle && (
        <div
          className={CUT_RESIZE_HANDLE_CLASS}
          style={{ left: 0 }}
          title="Drag to resize cut"
          aria-label="Resize cut start"
          onPointerDown={startResizeFromAnchor(cut.endSec)}
        />
      )}
      {showRightHandle && (
        <div
          className={CUT_RESIZE_HANDLE_CLASS}
          style={{ right: 0 }}
          title="Drag to resize cut"
          aria-label="Resize cut end"
          onPointerDown={startResizeFromAnchor(cut.startSec)}
        />
      )}
      <button
        type="button"
        className={CUT_RESTORE_BUTTON_CLASS}
        style={{ position: 'absolute', top: 2, right: 2 }}
        title="Restore this cut"
        aria-label="Restore this cut"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRestore}
      >
        <X size={10} />
      </button>
    </div>
  );
}
