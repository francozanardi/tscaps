import type { CutsWordCell } from '@presentation/cuts/services/CutsTimelineProjection';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import { percentage } from '@ui/pages/editor/features/cuts/utils';
import { CellCutButton } from '@ui/pages/editor/features/cuts/components/chips/CellCutButton';

const WORD_CHIP_CLASS =
  'group/chip flex items-center px-1 rounded-xs bg-surface-3 text-xs font-medium text-fg-primary overflow-hidden '
  + 'cursor-pointer';

const CHIP_TEXT_CLASS =
  'w-full min-w-0 truncate text-center '
  + 'transition-opacity duration-quick ease-standard group-hover/chip:opacity-40';

interface WordChipProps {
  cell: CutsWordCell;
  segmentStartSec: number;
  segmentDurationSec: number;
  onAddCut: (range: CutRange) => void;
  onSelect: (startSec: number, endSec: number) => void;
}

/**
 * One word's chip on the per-segment timeline. Positioned by time as a
 * percentage of the segment's own duration. Clicking selects the word's
 * range; the centered scissors button cuts it directly.
 */
export function WordChip({ cell, segmentStartSec, segmentDurationSec, onAddCut, onSelect }: WordChipProps) {
  const leftPct = percentage(cell.startSec - segmentStartSec, segmentDurationSec);
  const widthPct = percentage(cell.endSec - cell.startSec, segmentDurationSec);
  return (
    <span
      className={WORD_CHIP_CLASS}
      style={{ position: 'absolute', left: leftPct, top: 4, width: `calc(${widthPct} - 1px)`, bottom: 4 }}
      title={cell.text}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect(cell.startSec, cell.endSec)}
    >
      <span className={CHIP_TEXT_CLASS}>{cell.text}</span>
      <CellCutButton
        label={`Cut word "${cell.text}"`}
        onCut={() => onAddCut({ startSec: cell.startSec, endSec: cell.endSec })}
      />
    </span>
  );
}
