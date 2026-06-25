import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Scissors } from 'lucide-react';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { CutsSegmentRow } from '@presentation/cuts/services/CutsTimelineProjection';
import type { CutsWaveformData } from '@presentation/cuts/controllers/CutsWaveformController';
import { formatTimeRange } from '@ui/pages/editor/features/cuts/utils';
import { useCutsEditingController } from '@ui/pages/editor/features/cuts/contexts/CutsEditingContext';
import { useCutsSelection } from '@ui/pages/editor/features/cuts/hooks/useCutsEditing';
import { WordChip } from '@ui/pages/editor/features/cuts/components/chips/WordChip';
import { GapChip } from '@ui/pages/editor/features/cuts/components/chips/GapChip';
import { SegmentWaveform } from '@ui/pages/editor/features/cuts/components/SegmentWaveform';
import { CutOverlay } from '@ui/pages/editor/features/cuts/components/overlays/CutOverlay';
import { SelectionOverlay } from '@ui/pages/editor/features/cuts/components/overlays/SelectionOverlay';
import { HoverCursor } from '@ui/pages/editor/features/cuts/components/overlays/HoverCursor';
import { PlaybackCursor } from '@ui/pages/editor/features/cuts/components/overlays/PlaybackCursor';
import { SelectionActions } from '@ui/pages/editor/features/cuts/components/SelectionActions';

const TRACK_HEIGHT_PX = 40;
const WAVEFORM_HEIGHT_PX = 32;

const SEGMENT_ROW_CLASS =
  'group/segment flex flex-col gap-2 bg-surface-2 border border-edge-subtle rounded-md p-2';

const SEGMENT_HEADER_CLASS =
  'flex items-center justify-between gap-2 text-2xs font-mono uppercase tracking-wider text-fg-muted min-h-[20px]';

const SEGMENT_CUT_BUTTON_CLASS =
  'pointer-events-auto inline-flex items-center justify-center w-4 h-4 rounded-xs ' +
  'bg-surface-1 border border-edge-medium text-fg-faint cursor-pointer ' +
  'opacity-0 group-hover/segment:opacity-100 transition-opacity duration-quick ease-standard ' +
  'hover:bg-danger/15 hover:border-danger hover:text-danger ' +
  'focus-visible:outline-none focus-visible:opacity-100 focus-visible:border-accent';

const INTERACTION_ZONE_CLASS = 'flex flex-col gap-2 touch-none select-none cursor-crosshair';

const TRACK_CLASS = 'bg-surface-1 border border-edge-subtle rounded-sm';

const WAVEFORM_TRACK_CLASS = 'bg-surface-1 border border-edge-subtle rounded-sm overflow-hidden';

const OVERLAY_LAYER_CLASS = 'pointer-events-none';

interface SegmentTimelineRowProps {
  row: CutsSegmentRow;
  cuts: ReadonlyArray<CutRange>;
  waveform: CutsWaveformData | null;
  onSeek: (timeSec: number) => void;
  onAddCut: (range: CutRange) => void;
  onRestoreRange: (range: CutRange) => void;
  onResizeCut: (originalRange: CutRange, newRange: CutRange) => void;
}

/**
 * One segment's row in the per-segment timeline. Wraps a horizontal
 * track with absolutely-positioned word and gap chips, an optional
 * waveform strip, and a stack of overlays (cuts, drag selection,
 * playhead, hover cursor). Pointer interactions on the track drive
 * seek (click on empty space), select-then-cut (drag), select-this-cell
 * (click on a chip), edge-resize on the active selection, and
 * edge-resize on stored cuts, all routed through the editing
 * controller. Move and up events on the parent zone resolve which
 * gesture is in flight and dispatch accordingly.
 */
export function SegmentTimelineRow({
  row,
  cuts,
  waveform,
  onSeek,
  onAddCut,
  onRestoreRange,
  onResizeCut,
}: SegmentTimelineRowProps) {
  const segDuration = row.endSec - row.startSec;
  const controller = useCutsEditingController();
  const selection = useCutsSelection();
  const zoneRef = useRef<HTMLDivElement>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  const activeSelection = selection && selection.segmentId === row.segmentId ? selection : null;
  const cutsInRange = cuts.filter((cut) => cut.endSec > row.startSec && cut.startSec < row.endSec);
  const isSegmentFullyCut = cuts.some((cut) => cut.startSec <= row.startSec && cut.endSec >= row.endSec);

  const commitCut = (range: CutRange) => {
    onAddCut(range);
    controller.clearSelection();
  };

  const restoreCutSlice = (cut: CutRange) => {
    onRestoreRange({
      startSec: Math.max(cut.startSec, row.startSec),
      endSec: Math.min(cut.endSec, row.endSec),
    });
  };

  const selectCellRange = (startSec: number, endSec: number) => {
    controller.selectRange(row.segmentId, startSec, endSec);
  };

  const pointerToSec = (e: ReactPointerEvent<HTMLDivElement>): number => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return row.startSec;
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return row.startSec + fraction * segDuration;
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    controller.startDrag(row.segmentId, pointerToSec(e));
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverFraction(fraction);
    }
    if (controller.isCutEditing) {
      controller.extendCutEdit(pointerToSec(e));
      return;
    }
    if (controller.isDragging) {
      controller.extendDrag(pointerToSec(e));
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (controller.isCutEditing) {
      const result = controller.endCutEdit();
      if (result) onResizeCut(result.originalRange, result.newRange);
      return;
    }
    const result = controller.endDrag();
    if (result.wasClick && result.clickedSec !== null) {
      onSeek(result.clickedSec);
    }
  };

  const handlePointerLeave = () => {
    setHoverFraction(null);
  };

  return (
    <div className={SEGMENT_ROW_CLASS}>
      <div className={SEGMENT_HEADER_CLASS}>
        {activeSelection ? (
          <SelectionActions
            selection={activeSelection}
            onCut={() => commitCut({ startSec: activeSelection.startSec, endSec: activeSelection.endSec })}
            onCancel={() => controller.clearSelection()}
          />
        ) : (
          <>
            <span>{formatTimeRange(row.startSec, row.endSec)}</span>
            {!isSegmentFullyCut && (
              <button
                type="button"
                className={SEGMENT_CUT_BUTTON_CLASS}
                title="Cut this entire segment"
                aria-label="Cut this entire segment"
                onClick={() => commitCut({ startSec: row.startSec, endSec: row.endSec })}
              >
                <Scissors size={10} />
              </button>
            )}
          </>
        )}
      </div>
      <div
        ref={zoneRef}
        className={INTERACTION_ZONE_CLASS}
        style={{ position: 'relative' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <div
          className={TRACK_CLASS}
          style={{ position: 'relative', width: '100%', height: TRACK_HEIGHT_PX }}
        >
          {/* 1px horizontal inset so the first/last cell don't kiss the track border. */}
          <div style={{ position: 'absolute', left: 1, right: 1, top: 0, bottom: 0 }}>
            {row.cells.map((cell, index) => (
              cell.kind === 'word'
                ? <WordChip key={cell.id} cell={cell} segmentStartSec={row.startSec} segmentDurationSec={segDuration} onAddCut={commitCut} onSelect={selectCellRange} />
                : <GapChip key={`gap-${index}`} cell={cell} segmentStartSec={row.startSec} segmentDurationSec={segDuration} onAddCut={commitCut} onSelect={selectCellRange} />
            ))}
          </div>
        </div>
        {waveform && (
          <div className={WAVEFORM_TRACK_CLASS} style={{ width: '100%' }}>
            <SegmentWaveform
              peaks={waveform.peaks}
              peaksPerSecond={waveform.peaksPerSecond}
              startSec={row.startSec}
              endSec={row.endSec}
              heightPx={WAVEFORM_HEIGHT_PX}
            />
          </div>
        )}
        <div className={OVERLAY_LAYER_CLASS} style={{ position: 'absolute', inset: 0 }}>
          {cutsInRange.map((cut, index) => (
            <CutOverlay
              key={`cut-${index}-${cut.startSec.toFixed(3)}`}
              cut={cut}
              segmentId={row.segmentId}
              segmentStartSec={row.startSec}
              segmentDurationSec={segDuration}
              onRestore={() => restoreCutSlice(cut)}
            />
          ))}
          {activeSelection && (
            <SelectionOverlay
              selection={activeSelection}
              segmentStartSec={row.startSec}
              segmentDurationSec={segDuration}
            />
          )}
          <PlaybackCursor segmentStartSec={row.startSec} segmentEndSec={row.endSec} />
          {hoverFraction !== null && <HoverCursor fraction={hoverFraction} />}
        </div>
      </div>
    </div>
  );
}
