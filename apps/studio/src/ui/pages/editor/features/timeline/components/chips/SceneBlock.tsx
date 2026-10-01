import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { TimelineSpan } from '@presentation/timeline/services/TimelineSpan';
import type { TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import { TimelineScenePalette } from '@presentation/timeline/services/TimelineScenePalette';
import type {
  TimelineSceneDragTarget,
  TimelineSceneDragTargets,
} from '@presentation/timeline/services/TimelineSceneDragTargets';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useTimelineCellHovered } from '@ui/pages/editor/features/timeline/contexts/TimelineCellHoverContext';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { useTimelineHeldSceneIds } from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { percentage, pointerOrigin, sceneCellId } from '@ui/pages/editor/features/timeline/utils';
import { ScenePopover } from '@ui/pages/editor/features/timeline/components/ScenePopover';
import { SceneWordSpan } from '@ui/pages/editor/features/timeline/components/chips/SceneWordSpan';

const palette = new TimelineScenePalette();

// The inset lives on the text, not here, for the same reason as on a
// word chip: `border-box` floors the used width at padding plus border,
// so a block carrying them could not draw narrower than their sum.
const BLOCK_CLASS =
  'absolute top-0 bottom-0 flex items-center border overflow-hidden p-0 '
  + 'text-xs font-medium text-fg-primary text-left '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none';

const LIVE_BLOCK_CLASS = 'cursor-grab active:cursor-grabbing';

// Lifted and inert while it is being carried: it reads as picked up off
// the track and never takes the pointer that is already driving it.
const PREVIEW_BLOCK_CLASS = 'shadow-md z-10 pointer-events-none';

// A side that was cut loses its corner and its edge, which is what says
// the scene carries on in the next row.
const OPEN_START_CLASS = 'rounded-l-none border-l-0';
const OPEN_END_CLASS = 'rounded-r-none border-r-0';

const HELD_CLASS = 'ring-2 ring-accent ring-inset';

const DIMMED_CLASS = 'opacity-40';
const SEARCH_MATCH_CLASS = 'ring-2 ring-fg-muted ring-inset';

const BLOCK_TEXT_CLASS = 'w-full min-w-0 px-1.5 truncate';

const RESIZE_HANDLE_CLASS = 'absolute top-0 bottom-0 w-2 z-10 cursor-ew-resize';

// Blocks butt against each other, so each gives up a pixel at its end;
// without it two scenes read as one. A cut side gives up nothing.
const BLOCK_END_GAP_PX = 1;

const ACCENT_EDGE = 'rgb(var(--color-accent))';

interface SceneBlockProps {
  /** Its span is everything the scene occupies; its `window` is what the block draws. */
  run: TimelineSceneRun;
  rowStartSec: number;
  rowDurationSec: number;
  isHeld: boolean;
  isSearchMatch: boolean;
  /** Absent on a block that is only the live preview of scenes being carried. */
  dragTarget: TimelineSceneDragTarget | null;
  /** Every scene drawn, for carrying this one along with others. */
  sceneDragTargets: TimelineSceneDragTargets;
  /** Another scene is open word by word; this one stays usable but steps back. */
  isDimmed: boolean;
  /** The window while one of its ends is being dragged. */
  editedWindow: TimelineSpan | null;
  onCutScene: (startSec: number, endSec: number) => void;
}

/**
 * One scene as a single block, while the timeline is read scene by
 * scene. It is the only thing at this level that can be taken hold of,
 * so every gesture on it means something about the scene:
 *
 * - dragging the body carries the scene, words and all, through time —
 *   together with every scene after it when Shift is held, or with the
 *   whole group when it was taken with every scene before or after it;
 * - dragging an end changes the window it is shown for;
 * - a press that never travels, or a right-click, takes hold of it and
 *   opens what else can be done with it;
 * - a double-click opens it word by word, in place.
 *
 * A line from its first word to its last always says where it is
 * actually spoken, inside the block or past it.
 *
 * Cut into one piece per row it crosses, like a word; every piece
 * carries the scene's text and each end's handle appears only on the
 * piece holding that end.
 */
export function SceneBlock({
  run,
  rowStartSec,
  rowDurationSec,
  isHeld,
  isSearchMatch,
  dragTarget,
  sceneDragTargets,
  isDimmed,
  editedWindow,
  onCutScene,
}: SceneBlockProps) {
  const editingController = useTimelineEditingController();
  const dragController = useTimelinePointerDragController();
  const captions = useCaptions();
  const isLit = useTimelineCellHovered(sceneCellId(run.segmentId), true);
  const heldSceneIds = useTimelineHeldSceneIds();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressOffsetPx, setPressOffsetPx] = useState(0);
  const blockRef = useRef<HTMLButtonElement>(null);

  const rowEndSec = rowStartSec + rowDurationSec;
  const window = editedWindow ?? run.window;
  const startSec = Math.max(window.startSec, rowStartSec);
  const endSec = Math.min(window.endSec, rowEndSec);
  const cutAtStart = window.startSec < rowStartSec;
  const cutAtEnd = window.endSec > rowEndSec;
  const isLive = dragTarget !== null;

  const carry = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !isLive) return;
    e.stopPropagation();
    dragController.beginSceneMove(sceneDragTargets.subjectsFor(carriedWith(e.shiftKey)), pointerOrigin(e));
  };

  const carriedWith = (withFollowing: boolean): ReadonlySet<string> => {
    if (withFollowing) return sceneDragTargets.fromOnward(run.segmentId);
    if (heldSceneIds.has(run.segmentId)) return heldSceneIds;
    return new Set([run.segmentId]);
  };

  const dragEdge = (edge: 'start' | 'end') => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !dragTarget) return;
    e.stopPropagation();
    dragController.beginSceneEdgeDrag(dragTarget, edge, pointerOrigin(e));
  };

  // Recorded before the menu opens, in the block's own coordinates, so a
  // scene long enough to fill a row still puts its menu under the
  // pointer instead of at the far end of the row. Measured against the
  // block even when the press landed on its speech line, which is where
  // the menu is anchored.
  const takeHold = (e: ReactMouseEvent<HTMLElement>) => {
    const blockLeftPx = blockRef.current?.getBoundingClientRect().left ?? e.clientX;
    setPressOffsetPx(e.clientX - blockLeftPx);
    if (!isHeld) editingController.selectScene(run.segmentId);
  };

  // Its first click already opened the menu; opening the scene is the
  // reader moving past it, so the menu goes rather than hanging over the
  // words it would cover.
  const openWords = () => {
    setMenuOpen(false);
    editingController.openScene(run.segmentId, { startSec: run.startSec, endSec: run.endSec });
  };

  // The menu is what a right-click is for anywhere else, so it opens it
  // here too instead of the browser's own. A left press toggles the menu
  // through its trigger; this only ever opens it.
  const openMenu = (e: ReactMouseEvent<HTMLElement>) => {
    e.preventDefault();
    takeHold(e);
    setMenuOpen(true);
  };

  const widthPct = percentage(endSec - startSec, rowDurationSec);
  const classes = [
    BLOCK_CLASS,
    isLive ? LIVE_BLOCK_CLASS : PREVIEW_BLOCK_CLASS,
    cutAtStart ? OPEN_START_CLASS : 'rounded-l-xs',
    cutAtEnd ? OPEN_END_CLASS : 'rounded-r-xs',
    isHeld ? HELD_CLASS : (isSearchMatch ? SEARCH_MATCH_CLASS : ''),
    isDimmed ? DIMMED_CLASS : '',
  ].join(' ');

  const block = (
    <button
      ref={blockRef}
      type="button"
      className={classes}
      style={{
        left: percentage(startSec - rowStartSec, rowDurationSec),
        width: cutAtEnd ? widthPct : `calc(${widthPct} - ${BLOCK_END_GAP_PX}px)`,
        backgroundColor: palette.litWashColorFor(run.toneIndex),
        borderColor: isLit && isLive ? ACCENT_EDGE : palette.barColorFor(run.toneIndex),
      }}
      title={run.text}
      aria-label={`Scene: ${run.text}`}
      onPointerDown={carry}
      onClick={takeHold}
      onContextMenu={isLive ? openMenu : undefined}
      onDoubleClick={isLive ? openWords : undefined}
    >
      <span className={BLOCK_TEXT_CLASS}>{run.text}</span>
      {isLive && !cutAtStart && (
        <span
          className={RESIZE_HANDLE_CLASS}
          style={{ left: 0 }}
          title="Drag to change when this scene starts"
          aria-label="Scene start"
          onPointerDown={dragEdge('start')}
        />
      )}
      {isLive && !cutAtEnd && (
        <span
          className={RESIZE_HANDLE_CLASS}
          style={{ right: 0 }}
          title="Drag to change when this scene stops"
          aria-label="Scene end"
          onPointerDown={dragEdge('end')}
        />
      )}
    </button>
  );

  return (
    <>
      {endSec > startSec && (isLive ? (
        <ScenePopover
          open={menuOpen}
          onOpenChange={setMenuOpen}
          durationSec={run.window.endSec - run.window.startSec}
          pressOffsetPx={pressOffsetPx}
          onSelectScene={() => editingController.selectRange(run.startSec, run.endSec)}
          onEditWords={openWords}
          onRedistributeWords={() => captions.actions.segments.redistributeWords.execute(run.segmentId)}
          onSelectBackward={() => editingController.selectSceneGroup(
            run.segmentId,
            sceneDragTargets.upTo(run.segmentId),
          )}
          onSelectOnward={() => editingController.selectSceneGroup(
            run.segmentId,
            sceneDragTargets.fromOnward(run.segmentId),
          )}
          // Nothing holds a scene that no longer plays: the cut is what the
          // hold was for, and leaving it held would ring a stretch of
          // timeline the video has stopped having.
          onCutScene={() => {
            onCutScene(run.startSec, run.endSec);
            editingController.clearSceneSelection();
          }}
          trigger={block}
        />
      ) : block)}
      {/* After the block, so the line sits on top of it where they overlap. */}
      {run.words && (
        <SceneWordSpan
          words={run.words}
          window={window}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
          color={palette.barColorFor(run.toneIndex)}
          isDimmed={isDimmed}
          onPress={isLive ? carry : null}
          onOpenMenu={isLive ? openMenu : null}
        />
      )}
    </>
  );
}
