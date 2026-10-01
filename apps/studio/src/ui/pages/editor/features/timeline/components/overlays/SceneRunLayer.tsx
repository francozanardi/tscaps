import type { TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import { SceneRun } from '@ui/pages/editor/features/timeline/components/overlays/SceneRun';

const LAYER_CLASS = 'absolute inset-0 pointer-events-none';

interface SceneRunLayerProps {
  sceneRuns: ReadonlyArray<TimelineSceneRun>;
  rowStartSec: number;
  rowDurationSec: number;
  /** The scene a search match is sitting on, which is not a selection. */
  highlightedSegmentId: string | null;
}

/**
 * Where the scenes run behind one row's channel of words, while the
 * timeline is read word by word. It never takes the pointer: every press
 * here belongs to a word or to the row.
 */
export function SceneRunLayer({
  sceneRuns,
  rowStartSec,
  rowDurationSec,
  highlightedSegmentId,
}: SceneRunLayerProps) {
  return (
    <div className={LAYER_CLASS}>
      {sceneRuns.map((run) => (
        <SceneRun
          key={run.segmentId}
          run={run}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
          isSearchMatch={run.segmentId === highlightedSegmentId}
        />
      ))}
    </div>
  );
}
