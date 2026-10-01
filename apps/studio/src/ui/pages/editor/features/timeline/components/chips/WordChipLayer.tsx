import type { TimelineWordEdit } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineWordDragTarget } from '@presentation/timeline/controllers/gestures/TimelineWordEditGesture';
import type { TimelineOverlapSpan, TimelineWordCell } from '@presentation/timeline/services/TimelineProjection';
import { WordChip } from '@ui/pages/editor/features/timeline/components/chips/WordChip';
import { WordOverlapOverlay } from '@ui/pages/editor/features/timeline/components/overlays/WordOverlapOverlay';

interface WordChipLayerProps {
  cells: ReadonlyArray<TimelineWordCell>;
  overlaps: ReadonlyArray<TimelineOverlapSpan>;
  rowStartSec: number;
  rowEndSec: number;
  rowDurationSec: number;
  /** What dragging a word needs; `null` leaves that word drawn but not draggable. */
  dragTargetOf: (wordId: string) => TimelineWordDragTarget | null;
  /** The word being dragged, if this layer is where it belongs. */
  wordEdit: TimelineWordEdit | null;
}

/**
 * Words as chips across one row, with the marking for any stretch two
 * words of a scene share.
 *
 * The word currently being dragged is drawn from the live edit rather
 * than from the row's own cells, because it can be pulled past the row
 * it started in.
 */
export function WordChipLayer({
  cells,
  overlaps,
  rowStartSec,
  rowEndSec,
  rowDurationSec,
  dragTargetOf,
  wordEdit,
}: WordChipLayerProps) {
  const draggedWordId = wordEdit?.wordId ?? null;
  const showsDraggedWord = wordEdit !== null
    && wordEdit.range.endSec > rowStartSec
    && wordEdit.range.startSec < rowEndSec;

  // The dragged word is cut to this row the same way a settled one is,
  // so crossing a boundary mid-drag looks like where it will land.
  const draggedCell: TimelineWordCell | null = showsDraggedWord && wordEdit
    ? {
      id: wordEdit.wordId,
      text: wordEdit.text,
      segmentId: wordEdit.segmentId,
      startSec: Math.max(wordEdit.range.startSec, rowStartSec),
      endSec: Math.min(wordEdit.range.endSec, rowEndSec),
      fullStartSec: wordEdit.range.startSec,
      fullEndSec: wordEdit.range.endSec,
      cutAtStart: wordEdit.range.startSec < rowStartSec,
      cutAtEnd: wordEdit.range.endSec > rowEndSec,
      isWidestPiece: false,
    }
    : null;

  return (
    <>
      {cells.map((cell) => (
        cell.id === draggedWordId ? null : (
          <WordChip
            key={`${cell.id}-${cell.startSec}`}
            cell={cell}
            rowStartSec={rowStartSec}
            rowDurationSec={rowDurationSec}
            dragTarget={dragTargetOf(cell.id)}
          />
        )
      ))}
      <WordOverlapOverlay
        overlaps={overlaps}
        rowStartSec={rowStartSec}
        rowDurationSec={rowDurationSec}
      />
      {draggedCell && (
        <WordChip
          cell={draggedCell}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
          dragTarget={null}
        />
      )}
    </>
  );
}
