import {
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TimelineSpan } from '@presentation/timeline/services/TimelineSpan';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { percentage } from '@ui/pages/editor/features/timeline/utils';
import { SceneSpeechSummary } from '@ui/pages/editor/features/timeline/components/chips/SceneSpeechSummary';

// Laid over the block's bottom border rather than floating inside the
// block: a thicker stretch of the block's own floor reads as part of the
// block, where a line hanging above it reads as something left behind.
const LINE_CLASS = 'absolute bottom-0 pointer-events-none transition-[height] duration-quick ease-standard';
const LINE_HEIGHT_CLASS = 'h-0.5';
const LINE_HOVER_HEIGHT_CLASS = 'h-[3px]';

// An end cap at each end turns the line into a measurement — from here to
// here — rather than a decoration.
const CAP_CLASS = 'absolute bottom-0 w-0.5 h-[5px] pointer-events-none';

// A dashed stretch is too thin to point at, so a taller strip along the
// floor answers for it. It never lights `accent`: the stretch explains,
// and a press on it is a press on the scene.
const HIT_STRIP_CLASS = 'absolute bottom-0 h-2 cursor-grab active:cursor-grabbing';

const DASH_PX = 3;

const DIMMED_CLASS = 'opacity-40';

interface Stretch {
  readonly startSec: number;
  readonly endSec: number;
  /** Past the window: spoken while the scene is not on screen. */
  readonly offScreen: boolean;
}

interface SceneWordSpanProps {
  /** From where the scene's first word starts to where its last one ends. */
  words: TimelineSpan;
  /** The stretch the scene is shown for. */
  window: TimelineSpan;
  rowStartSec: number;
  rowDurationSec: number;
  color: string;
  /** Another scene is open word by word, and this line steps back with its block. */
  isDimmed: boolean;
  /**
   * What a press on an off-screen stretch does, which is whatever a press
   * on the scene does. Absent on a scene that is only being previewed,
   * whose line never answers the pointer.
   */
  onPress: ((e: ReactPointerEvent<HTMLElement>) => void) | null;
  onOpenMenu: ((e: ReactMouseEvent<HTMLElement>) => void) | null;
}

/**
 * Where a scene is actually spoken, as a capped line along the floor of
 * the block that stands for the window it is shown for.
 *
 * Read against that block it says the one thing the block cannot: the
 * block running past the line is padding. The line is solid where the
 * window covers it and dashed where it runs past the window — speech the
 * window was shrunk away from.
 *
 * **Only the dashed stretches answer the pointer.** Outside the block
 * each one is plainly a thing of its own, so a tooltip over it can only
 * be about it. The solid stretch lies inside the block, where a tooltip
 * would read as being about the scene and leave a casual reader asking
 * what it meant. Pointing at a dashed stretch thickens it and states the
 * numbers; a press on it is a press on the scene.
 *
 * Clipped to the row like any piece; a cap is drawn only by the row
 * holding its end.
 */
export function SceneWordSpan({
  words,
  window,
  rowStartSec,
  rowDurationSec,
  color,
  isDimmed,
  onPress,
  onOpenMenu,
}: SceneWordSpanProps) {
  const [isHovered, setHovered] = useState(false);
  const rowEndSec = rowStartSec + rowDurationSec;
  const dashes = `repeating-linear-gradient(to right, ${color} 0 ${DASH_PX}px, transparent ${DASH_PX}px ${DASH_PX * 2}px)`;
  const stretches: Stretch[] = [
    { startSec: words.startSec, endSec: Math.min(words.endSec, window.startSec), offScreen: true },
    {
      startSec: Math.max(words.startSec, window.startSec),
      endSec: Math.min(words.endSec, window.endSec),
      offScreen: false,
    },
    { startSec: Math.max(words.startSec, window.endSec), endSec: words.endSec, offScreen: true },
  ]
    .map((stretch) => ({
      ...stretch,
      startSec: Math.max(stretch.startSec, rowStartSec),
      endSec: Math.min(stretch.endSec, rowEndSec),
    }))
    .filter((stretch) => stretch.endSec > stretch.startSec);
  const showsStartCap = words.startSec >= rowStartSec && words.startSec <= rowEndSec;
  const showsEndCap = words.endSec >= rowStartSec && words.endSec <= rowEndSec;
  const placement = (stretch: Stretch) => ({
    left: percentage(stretch.startSec - rowStartSec, rowDurationSec),
    width: percentage(stretch.endSec - stretch.startSec, rowDurationSec),
  });

  return (
    <span className={isDimmed ? DIMMED_CLASS : undefined}>
      {stretches.map((stretch) => (
        <span
          key={stretch.startSec}
          className={`${LINE_CLASS} ${stretch.offScreen && isHovered ? LINE_HOVER_HEIGHT_CLASS : LINE_HEIGHT_CLASS}`}
          style={{ ...placement(stretch), background: stretch.offScreen ? dashes : color }}
        />
      ))}
      {showsStartCap && (
        <span
          className={CAP_CLASS}
          style={{ left: percentage(words.startSec - rowStartSec, rowDurationSec), backgroundColor: color }}
        />
      )}
      {showsEndCap && (
        <span
          className={`${CAP_CLASS} -translate-x-full`}
          style={{ left: percentage(words.endSec - rowStartSec, rowDurationSec), backgroundColor: color }}
        />
      )}
      {onPress && onOpenMenu && stretches.filter((stretch) => stretch.offScreen).map((stretch) => (
        <Tooltip
          key={`hit-${stretch.startSec}`}
          text={<SceneSpeechSummary words={words} window={window} />}
          position="bottom"
        >
          <span
            className={HIT_STRIP_CLASS}
            style={placement(stretch)}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onPointerDown={onPress}
            onClick={onOpenMenu}
            onContextMenu={onOpenMenu}
          />
        </Tooltip>
      ))}
    </span>
  );
}
