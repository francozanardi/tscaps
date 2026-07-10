import type { CutsGapCell } from '@presentation/cuts/services/CutsTimelineProjection';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import { percentage } from '@ui/pages/editor/features/cuts/utils';
import { CellCutButton } from '@ui/pages/editor/features/cuts/components/chips/CellCutButton';

const GAP_CHIP_CLASS =
  'group/chip flex items-center px-1 rounded-xs border border-dashed border-edge-medium text-2xs font-mono text-fg-faint overflow-hidden '
  + 'cursor-pointer';

const CHIP_TEXT_CLASS =
  'w-full min-w-0 truncate text-center '
  + 'transition-opacity duration-quick ease-standard group-hover/chip:opacity-40';

interface GapChipProps {
  cell: CutsGapCell;
  segmentStartSec: number;
  segmentDurationSec: number;
  onAddCut: (range: CutRange) => void;
  onSelect: (startSec: number, endSec: number) => void;
}

/**
 * Intra-segment silence chip, sized to the silence duration as a
 * percentage of the segment's own duration. Behaves like a word chip:
 * click selects, the centered scissors cuts the silence away.
 */
export function GapChip({ cell, segmentStartSec, segmentDurationSec, onAddCut, onSelect }: GapChipProps) {
  const leftPct = percentage(cell.startSec - segmentStartSec, segmentDurationSec);
  const widthPct = percentage(cell.endSec - cell.startSec, segmentDurationSec);
  const seconds = cell.endSec - cell.startSec;
  return (
    <span
      className={GAP_CHIP_CLASS}
      style={{ position: 'absolute', left: leftPct, top: 6, width: `calc(${widthPct} - 1px)`, bottom: 6 }}
      title={`Silence ${seconds.toFixed(2)}s`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect(cell.startSec, cell.endSec)}
    >
      <span className={CHIP_TEXT_CLASS}>{seconds.toFixed(1)}s</span>
      <CellCutButton
        label={`Cut silence ${seconds.toFixed(2)}s`}
        onCut={() => onAddCut({ startSec: cell.startSec, endSec: cell.endSec })}
      />
    </span>
  );
}
