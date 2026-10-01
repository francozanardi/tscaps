import type {
  TimelineOpenedScene,
  TimelineWordEdit,
} from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineWordDragTarget } from '@presentation/timeline/controllers/gestures/TimelineWordEditGesture';
import type { TimelineOverlapSpan, TimelineWordCell } from '@presentation/timeline/services/TimelineProjection';
import { TimelineScenePalette } from '@presentation/timeline/services/TimelineScenePalette';
import type { TimelineWordDragTargets } from '@presentation/timeline/services/TimelineWordDragTargets';
import { percentage } from '@ui/pages/editor/features/timeline/utils';
import { WordChipLayer } from '@ui/pages/editor/features/timeline/components/chips/WordChipLayer';

const palette = new TimelineScenePalette();

// The scene's own tone, as ground for its words and outlined so the
// stretch it was opened over reads as one place. Never `accent`: that
// means held, and an opened scene is not held.
const FRAME_CLASS = 'absolute top-0 bottom-0 border border-dashed rounded-xs pointer-events-none';

interface OpenedSceneWordsProps {
  opened: TimelineOpenedScene;
  toneIndex: number;
  cells: ReadonlyArray<TimelineWordCell>;
  overlaps: ReadonlyArray<TimelineOverlapSpan>;
  rowStartSec: number;
  rowEndSec: number;
  rowDurationSec: number;
  dragTargets: TimelineWordDragTargets;
  wordEdit: TimelineWordEdit | null;
}

/**
 * One scene opened word by word inside the scene level: its words as
 * chips, moved and stretched exactly as at the word level, over a frame
 * marking the stretch the scene was opened over.
 *
 * **The words stay inside that stretch.** Every word keeps the limits it
 * always has — its neighbours, the scenes of its own sheet, the video —
 * and on top of them the frame: an edit made while reading one scene
 * should change nothing outside what the reader is looking at.
 */
export function OpenedSceneWords({
  opened,
  toneIndex,
  cells,
  overlaps,
  rowStartSec,
  rowEndSec,
  rowDurationSec,
  dragTargets,
  wordEdit,
}: OpenedSceneWordsProps) {
  const { extent } = opened;
  const ownCells = cells.filter((cell) => cell.segmentId === opened.segmentId);
  const ownOverlaps = overlaps.filter((overlap) => (
    overlap.startSec >= extent.startSec && overlap.endSec <= extent.endSec
  ));
  const ownWordEdit = wordEdit?.segmentId === opened.segmentId ? wordEdit : null;
  const frameStartSec = Math.max(extent.startSec, rowStartSec);
  const frameEndSec = Math.min(extent.endSec, rowEndSec);

  const dragTargetOf = (wordId: string): TimelineWordDragTarget | null => {
    const target = dragTargets.get(wordId);
    if (!target) return null;
    return {
      ...target,
      outerLimits: {
        earliestStartSec: Math.max(target.outerLimits.earliestStartSec, extent.startSec),
        latestEndSec: Math.min(target.outerLimits.latestEndSec, extent.endSec),
      },
    };
  };

  return (
    <>
      {frameEndSec > frameStartSec && (
        <span
          className={FRAME_CLASS}
          style={{
            left: percentage(frameStartSec - rowStartSec, rowDurationSec),
            width: percentage(frameEndSec - frameStartSec, rowDurationSec),
            backgroundColor: palette.washColorFor(toneIndex),
            borderColor: palette.barColorFor(toneIndex),
          }}
        />
      )}
      <WordChipLayer
        cells={ownCells}
        overlaps={ownOverlaps}
        rowStartSec={rowStartSec}
        rowEndSec={rowEndSec}
        rowDurationSec={rowDurationSec}
        dragTargetOf={dragTargetOf}
        wordEdit={ownWordEdit}
      />
    </>
  );
}
