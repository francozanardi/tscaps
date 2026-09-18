import { useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import { TimelineScenePalette } from '@presentation/timeline/services/TimelineScenePalette';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import type { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useTimelineCellHovered } from '@ui/pages/editor/features/timeline/contexts/TimelineCellHoverContext';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { percentage, pointerOrigin, sceneCellId } from '@ui/pages/editor/features/timeline/utils';
import { ScenePopover } from '@ui/pages/editor/features/timeline/components/ScenePopover';

const palette = new TimelineScenePalette();

const WASH_CLASS = 'absolute inset-y-0 transition-colors duration-quick ease-standard';

// The one thing in this layer that answers the pointer at rest. Its hit
// area is the bar plus the gap above it, which is all the room there is
// before the words start. The stretches between words stay with the row,
// where a press means starting a range and a click means moving the
// playhead.
const BAR_HIT_CLASS =
  'absolute pointer-events-auto cursor-pointer flex items-end focus-visible:outline-none';

// Only while the scene is not held. Closing the scene's own menu hands
// focus back to this bar, and a held scene is already ringed — marking
// it twice reads as something having gone wrong. What is left is the one
// case the mark is for: reaching the bar by keyboard without pressing it.
const BAR_FOCUS_CLASS =
  'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset focus-visible:rounded-xs';

const BAR_CLASS = 'w-full rounded-full transition-all duration-quick ease-standard';

// Thickening is kept for the bar alone while the tint answers from
// anywhere in the scene. That split is what lets the scene say "this
// stretch is one thing" everywhere without the bar losing its own claim
// to being the part that can be pressed. It grows upward into the gap
// the chips already leave above it, so nothing has to make room.
const BAR_HOVER_GROWTH_PX = 1;

// A held scene reads as an object rather than as ground: the bar
// thickens past any hover, and the whole window is ringed. The ring is
// `inset` so it lands on the scene's own edges, which is exactly where
// the handles are.
const HELD_BAR_GROWTH_PX = 3;
const HELD_FRAME_CLASS = 'absolute inset-y-0 ring-2 ring-accent ring-inset rounded-xs pointer-events-none';

const SEARCH_MATCH_CLASS = 'absolute inset-y-0 ring-2 ring-fg-muted ring-inset rounded-xs pointer-events-none';

// Above the word chips' own handles (`z-10`), which is the whole point:
// where a scene's edge and its first or last word's edge fall on the
// same pixel, the held scene wins. Everywhere else the word handles are
// untouched, because nothing overlaps them there.
const EDGE_HANDLE_CLASS =
  'absolute inset-y-0 w-2 -mx-1 z-20 pointer-events-auto cursor-ew-resize';

// Drawn inside the handle rather than as the handle, so the grabbable
// strip stays wider than the line the eye follows.
const EDGE_LINE_CLASS = 'absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-accent rounded-full';

// Scenes hand over mid-bar, so each stretch gives up a pixel at its end.
// Without it two scenes read as one long bar.
const BAR_END_GAP_PX = 1;

interface SceneRunProps {
  run: TimelineSceneRun;
  geometry: TimelineRowGeometry;
  rowStartSec: number;
  rowDurationSec: number;
  isSearchMatch: boolean;
  isHeld: boolean;
  /** The window being previewed while an edge of this scene is dragged. */
  heldWindow: { startSec: number; endSec: number } | null;
  sceneDragTargets: TimelineSceneDragTargets;
  onCutScene: (startSec: number, endSec: number) => void;
}

/**
 * One scene's stretch of a row, said twice in its own tone: a faint wash
 * behind the words and a solid bar under them.
 *
 * Pressing the bar **takes hold of the scene** and opens what else can
 * be done with it. Taking hold is a different thing from selecting a
 * stretch of video: a held scene is an object whose ends move its own
 * window, while a selection is a stretch to cut or to loop.
 *
 * A held scene's edge handles are drawn only in the row that holds each
 * edge, and only they answer the pointer there — everywhere else the
 * words keep their own.
 */
export function SceneRun({
  run,
  geometry,
  rowStartSec,
  rowDurationSec,
  isSearchMatch,
  isHeld,
  heldWindow,
  sceneDragTargets,
  onCutScene,
}: SceneRunProps) {
  const editingController = useTimelineEditingController();
  const dragController = useTimelinePointerDragController();
  const captions = useCaptions();
  // Read but never published here: the row announces which scene the
  // pointer is inside, which is the only way a bar drawn under the words
  // hears about a pointer sitting on one of them. Every row the scene
  // reaches lights at once, since they all read the same id.
  const isLit = useTimelineCellHovered(sceneCellId(run.segmentId), true);
  const [isBarHovered, setBarHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressOffsetPx, setPressOffsetPx] = useState(0);

  const rowEndSec = rowStartSec + rowDurationSec;
  // While an edge is being dragged the scene is drawn where it is being
  // taken, not where it is stored.
  const window = heldWindow ?? { startSec: run.startSec, endSec: run.endSec };

  // Clipped to the row it is drawn in: a scene crossing the boundary is
  // one scene shown in two places, not two scenes.
  const startSec = Math.max(window.startSec, rowStartSec);
  const endSec = Math.min(window.endSec, rowEndSec);
  const spanStyle = {
    left: percentage(startSec - rowStartSec, rowDurationSec),
    width: `calc(${percentage(endSec - startSec, rowDurationSec)} - ${BAR_END_GAP_PX}px)`,
  };

  const showStartHandle = isHeld && window.startSec >= rowStartSec && window.startSec <= rowEndSec;
  const showEndHandle = isHeld && window.endSec >= rowStartSec && window.endSec <= rowEndSec;

  const takeHold = () => {
    if (!isHeld) editingController.selectScene(run.segmentId);
  };

  const dragEdge = (edge: 'start' | 'end') => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragController.beginSceneEdgeDrag(sceneDragTargets.get(run.segmentId), edge, pointerOrigin(e));
  };

  // Recorded before the menu opens, in the bar's own coordinates, so a
  // scene long enough to fill a row still puts its menu under the
  // pointer instead of at the far end of the row.
  const recordPressOffset = (e: ReactMouseEvent<HTMLElement>) => {
    setPressOffsetPx(e.clientX - e.currentTarget.getBoundingClientRect().left);
  };

  const barGrowthPx = isHeld
    ? HELD_BAR_GROWTH_PX
    : (isBarHovered ? BAR_HOVER_GROWTH_PX : 0);

  return (
    <div>
      <div
        className={WASH_CLASS}
        style={{
          ...spanStyle,
          backgroundColor: isLit || isHeld
            ? palette.litWashColorFor(run.toneIndex)
            : palette.washColorFor(run.toneIndex),
        }}
      />
      <ScenePopover
        open={menuOpen}
        onOpenChange={setMenuOpen}
        durationSec={run.endSec - run.startSec}
        pressOffsetPx={pressOffsetPx}
        onSelectScene={() => editingController.selectRange(run.startSec, run.endSec)}
        onRedistributeWords={() => captions.actions.segments.redistributeWords.execute(run.segmentId)}
        // Nothing holds a scene that no longer plays: the cut is what the
        // hold was for, and leaving it held would ring a stretch of
        // timeline the video has stopped having.
        onCutScene={() => {
          onCutScene(run.startSec, run.endSec);
          editingController.clearSceneSelection();
        }}
        trigger={(
          <button
            type="button"
            className={isHeld ? BAR_HIT_CLASS : `${BAR_HIT_CLASS} ${BAR_FOCUS_CLASS}`}
            style={{
              ...spanStyle,
              bottom: geometry.barInsetBottomPx,
              height: geometry.sceneBarHeightPx + geometry.chipInsetTopPx,
            }}
            title="Select this scene"
            aria-label="Select this scene"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { recordPressOffset(e); takeHold(); }}
            onPointerEnter={() => setBarHovered(true)}
            onPointerLeave={() => setBarHovered(false)}
          >
            <div
              className={BAR_CLASS}
              style={{
                height: geometry.sceneBarHeightPx + barGrowthPx,
                backgroundColor: palette.barColorFor(run.toneIndex),
              }}
            />
          </button>
        )}
      />
      {isHeld && <div className={HELD_FRAME_CLASS} style={spanStyle} />}
      {showStartHandle && (
        <div
          className={EDGE_HANDLE_CLASS}
          style={{ left: percentage(window.startSec - rowStartSec, rowDurationSec) }}
          title="Drag to change when this scene starts"
          aria-label="Scene start"
          onPointerDown={dragEdge('start')}
        >
          <span className={EDGE_LINE_CLASS} />
        </div>
      )}
      {showEndHandle && (
        <div
          className={EDGE_HANDLE_CLASS}
          style={{ left: percentage(window.endSec - rowStartSec, rowDurationSec) }}
          title="Drag to change when this scene stops"
          aria-label="Scene end"
          onPointerDown={dragEdge('end')}
        >
          <span className={EDGE_LINE_CLASS} />
        </div>
      )}
      {isSearchMatch && !isHeld && (
        <div
          className={SEARCH_MATCH_CLASS}
          style={{
            left: percentage(run.startSec - rowStartSec, rowDurationSec),
            width: percentage(run.endSec - run.startSec, rowDurationSec),
          }}
        />
      )}
    </div>
  );
}
