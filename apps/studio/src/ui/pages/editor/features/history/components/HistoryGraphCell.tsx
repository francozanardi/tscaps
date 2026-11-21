import type { HistoryGraphRow } from '@presentation/editor/services/HistoryGraphLayout';

export const HISTORY_LANE_WIDTH = 14;
export const HISTORY_ROW_HEIGHT = 44;

const DOT_RADIUS = 4;

/**
 * The graph's slice for one row: the lines that cross it, the branches
 * that end in its dot, and the dot, filled for the checkpoint shown and
 * hollow elsewhere. The line of what the project shown is made of (lane
 * 0, below the checkpoint shown) is drawn in the accent; `belowShown` says
 * the row lies under the checkpoint shown.
 */
export function HistoryGraphCell({ row, laneCount, belowShown }: { row: HistoryGraphRow; laneCount: number; belowShown: boolean }) {
  const laneX = (lane: number): number => lane * HISTORY_LANE_WIDTH + HISTORY_LANE_WIDTH / 2;
  const width = laneCount * HISTORY_LANE_WIDTH;
  const middle = HISTORY_ROW_HEIGHT / 2;
  const dotX = laneX(row.lane);
  const ownLine = row.onShownPath ? 'stroke-accent' : 'stroke-fg-faint';
  return (
    <svg width={width} height={HISTORY_ROW_HEIGHT} className="shrink-0" aria-hidden>
      {row.through.map((lane) => (
        <line
          key={`through-${lane}`}
          x1={laneX(lane)}
          y1={0}
          x2={laneX(lane)}
          y2={HISTORY_ROW_HEIGHT}
          className={lane === 0 && belowShown ? 'stroke-accent' : 'stroke-fg-faint'}
          strokeWidth={1.5}
        />
      ))}
      {row.joins.map((lane) => (
        <path key={`join-${lane}`} d={`M ${laneX(lane)} 0 Q ${laneX(lane)} ${middle} ${dotX} ${middle}`} fill="none" className="stroke-fg-faint" strokeWidth={1.5} />
      ))}
      {row.lineAbove && <line x1={dotX} y1={0} x2={dotX} y2={middle} className={row.isShown ? 'stroke-fg-faint' : ownLine} strokeWidth={1.5} />}
      {row.lineBelow && <line x1={dotX} y1={middle} x2={dotX} y2={HISTORY_ROW_HEIGHT} className={ownLine} strokeWidth={1.5} />}
      <circle
        cx={dotX}
        cy={middle}
        r={DOT_RADIUS}
        strokeWidth={1.5}
        className={row.isShown ? 'fill-accent stroke-accent' : row.onShownPath ? 'fill-surface-2 stroke-accent' : 'fill-surface-2 stroke-fg-faint'}
      />
    </svg>
  );
}
