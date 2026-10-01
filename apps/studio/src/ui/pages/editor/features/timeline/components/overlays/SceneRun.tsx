import type { TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import { TimelineScenePalette } from '@presentation/timeline/services/TimelineScenePalette';
import { useTimelineCellHovered } from '@ui/pages/editor/features/timeline/contexts/TimelineCellHoverContext';
import { percentage, sceneCellId } from '@ui/pages/editor/features/timeline/utils';

const palette = new TimelineScenePalette();

const WASH_CLASS = 'absolute inset-y-0 transition-colors duration-quick ease-standard';

const SEARCH_MATCH_CLASS = 'absolute inset-y-0 ring-2 ring-fg-muted ring-inset rounded-xs pointer-events-none';

// Scenes hand over mid-row, so each stretch gives up a pixel at its end.
// Without it two scenes read as one long wash.
const WASH_END_GAP_PX = 1;

interface SceneRunProps {
  run: TimelineSceneRun;
  rowStartSec: number;
  rowDurationSec: number;
  isSearchMatch: boolean;
}

/**
 * One scene's stretch of a row while the timeline is read word by word:
 * a faint wash behind the words saying which of them belong together,
 * and nothing that answers the pointer. At this level the words are the
 * only thing to take hold of; the scene is ground.
 */
export function SceneRun({ run, rowStartSec, rowDurationSec, isSearchMatch }: SceneRunProps) {
  // Read but never published here: the row announces which scene the
  // pointer is inside, which is the only way a wash drawn under the
  // words hears about a pointer sitting on one of them. Every row the
  // scene reaches lights at once, since they all read the same id.
  const isLit = useTimelineCellHovered(sceneCellId(run.segmentId), true);

  // Clipped to the row it is drawn in: a scene crossing the boundary is
  // one scene shown in two places, not two scenes.
  const startSec = Math.max(run.startSec, rowStartSec);
  const endSec = Math.min(run.endSec, rowStartSec + rowDurationSec);

  return (
    <div>
      <div
        className={WASH_CLASS}
        style={{
          left: percentage(startSec - rowStartSec, rowDurationSec),
          width: `calc(${percentage(endSec - startSec, rowDurationSec)} - ${WASH_END_GAP_PX}px)`,
          backgroundColor: isLit
            ? palette.litWashColorFor(run.toneIndex)
            : palette.washColorFor(run.toneIndex),
        }}
      />
      {isSearchMatch && (
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
