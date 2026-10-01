import type { TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import type { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import {
  useTimelineHeldSceneIds,
  useTimelineSceneEditInRow,
  useTimelineSceneMoveInRow,
} from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { SceneBlock } from '@ui/pages/editor/features/timeline/components/chips/SceneBlock';

interface SceneBlockLayerProps {
  sceneRuns: ReadonlyArray<TimelineSceneRun>;
  rowStartSec: number;
  rowEndSec: number;
  rowDurationSec: number;
  sceneDragTargets: TimelineSceneDragTargets;
  /** The scene a search match is sitting on, which is not a selection. */
  highlightedSegmentId: string | null;
  /** The scene opened word by word, drawn elsewhere as its words; every other block is dimmed. */
  openedSegmentId: string | null;
  onCutScene: (startSec: number, endSec: number) => void;
}

/**
 * Every scene reaching one row, as blocks, while the timeline is read
 * scene by scene.
 *
 * Scenes being carried, and a window whose end is being pulled, are
 * drawn from the gesture rather than from what the row was given: both
 * can be taken into a row that never held them, and that row has no
 * other way to know they are there.
 *
 * What is held and what is moving are read here rather than by the row,
 * so a gesture redraws this layer alone and leaves the rest of the row
 * untouched.
 */
export function SceneBlockLayer({
  sceneRuns,
  rowStartSec,
  rowEndSec,
  rowDurationSec,
  sceneDragTargets,
  highlightedSegmentId,
  openedSegmentId,
  onCutScene,
}: SceneBlockLayerProps) {
  const heldSceneIds = useTimelineHeldSceneIds();
  const sceneEdit = useTimelineSceneEditInRow(rowStartSec, rowEndSec);
  const sceneMove = useTimelineSceneMoveInRow(rowStartSec, rowEndSec);
  const carriedIds = new Set(sceneMove?.subjects.map((subject) => subject.segmentId) ?? []);
  const editedIsHere = sceneEdit !== null && sceneRuns.some((run) => run.segmentId === sceneEdit.segmentId);

  const carriedSec = sceneMove?.deltaSec ?? 0;
  const carried: TimelineSceneRun[] = (sceneMove?.subjects ?? []).map((subject) => ({
    segmentId: subject.segmentId,
    text: subject.text,
    toneIndex: subject.toneIndex,
    startSec: subject.extent.startSec + carriedSec,
    endSec: subject.extent.endSec + carriedSec,
    window: {
      startSec: subject.window.startSec + carriedSec,
      endSec: subject.window.endSec + carriedSec,
    },
    words: subject.words && {
      startSec: subject.words.startSec + carriedSec,
      endSec: subject.words.endSec + carriedSec,
    },
  }));

  return (
    <>
      {sceneRuns.map((run) => (
        carriedIds.has(run.segmentId) || run.segmentId === openedSegmentId ? null : (
          <SceneBlock
            key={run.segmentId}
            run={run}
            rowStartSec={rowStartSec}
            rowDurationSec={rowDurationSec}
            isHeld={heldSceneIds.has(run.segmentId)}
            isSearchMatch={run.segmentId === highlightedSegmentId}
            dragTarget={sceneDragTargets.get(run.segmentId)}
            sceneDragTargets={sceneDragTargets}
            isDimmed={openedSegmentId !== null}
            editedWindow={sceneEdit?.segmentId === run.segmentId ? sceneEdit.range : null}
            onCutScene={onCutScene}
          />
        )
      ))}
      {sceneEdit && !editedIsHere && (
        <SceneBlock
          key={`edit-${sceneEdit.segmentId}`}
          run={{
            segmentId: sceneEdit.segmentId,
            text: sceneEdit.text,
            toneIndex: sceneEdit.toneIndex,
            ...sceneEdit.range,
            window: sceneEdit.range,
            words: null,
          }}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
          isHeld={heldSceneIds.has(sceneEdit.segmentId)}
          isSearchMatch={false}
          dragTarget={null}
          sceneDragTargets={sceneDragTargets}
          isDimmed={false}
          editedWindow={null}
          onCutScene={onCutScene}
        />
      )}
      {carried
        .filter((run) => run.endSec > rowStartSec && run.startSec < rowEndSec)
        .map((run) => (
          <SceneBlock
            key={`carried-${run.segmentId}`}
            run={run}
            rowStartSec={rowStartSec}
            rowDurationSec={rowDurationSec}
            isHeld={heldSceneIds.has(run.segmentId)}
            isSearchMatch={false}
            dragTarget={null}
            sceneDragTargets={sceneDragTargets}
            isDimmed={false}
            editedWindow={null}
            onCutScene={onCutScene}
          />
        ))}
    </>
  );
}
