import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineWordEdit } from '@presentation/timeline/controllers/TimelineEditingController';
import type {
  TimelineOverlapSpan,
  TimelineSceneRun,
  TimelineWordCell,
} from '@presentation/timeline/services/TimelineProjection';
import type { TimelineWordDragTargets } from '@presentation/timeline/services/TimelineWordDragTargets';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import { WordChipLayer } from '@ui/pages/editor/features/timeline/components/chips/WordChipLayer';
import { OpenedSceneWords } from '@ui/pages/editor/features/timeline/components/chips/OpenedSceneWords';
import { useTimelineOpenedScene } from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { SceneRunLayer } from '@ui/pages/editor/features/timeline/components/overlays/SceneRunLayer';
import { SceneBlockLayer } from '@ui/pages/editor/features/timeline/components/chips/SceneBlockLayer';
import type { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';

// A filled, outlined trough, so the channel is a thing rather than a
// stretch of empty track: unbounded chips read as words floating over
// the row rather than as words on a track. It takes the surface the
// chips were already measured against and lets the row show through
// around it, rather than the other way round — raising the channel's own
// surface costs the chips about forty percent of their contrast.
//
// An inset ring rather than a border: a border shifts the content box
// inward, which would put the chips on a different time-to-x mapping
// than the cut masks and the playhead.
const CHANNEL_CLASS =
  'absolute inset-x-0 top-0 overflow-hidden bg-surface-1 '
  + 'ring-1 ring-inset ring-edge-medium rounded-xs';

// Carries the inset from the channel's top, so a chip stays a plain
// `top: 0, bottom: 0` fill of whatever band it is given.
const CHIP_BAND_CLASS = 'absolute left-0 right-0';

interface ChannelProps {
  view: TimelineView;
  cells: ReadonlyArray<TimelineWordCell>;
  sceneRuns: ReadonlyArray<TimelineSceneRun>;
  overlaps: ReadonlyArray<TimelineOverlapSpan>;
  geometry: TimelineRowGeometry;
  rowStartSec: number;
  rowEndSec: number;
  rowDurationSec: number;
  dragTargets: TimelineWordDragTargets;
  sceneDragTargets: TimelineSceneDragTargets;
  onCutScene: (startSec: number, endSec: number) => void;
  wordEdit: TimelineWordEdit | null;
  highlightedSegmentId: string | null;
}

/**
 * The one band a row draws, read at one of two levels.
 *
 * **Words**: every word as a chip, over a faint wash in each scene's
 * tone, with the marking for any stretch two words of a scene share.
 * The words are what can be taken hold of; the scenes are ground.
 *
 * **Scenes**: every scene as one block. The block is what can be taken
 * hold of, and the words inside it travel with it. One scene at a time
 * can be opened word by word in place, with the other blocks dimmed.
 *
 * Each level has one kind of thing under the pointer, so a drag always
 * means the same thing within it.
 *
 * At most one scene runs at any instant, so a word never has to give way
 * to another: sheets that claim the same instant are read in separate
 * channels, and two segments of one sheet are kept from sharing one.
 *
 * The word currently being dragged is drawn from the live edit rather
 * than from the row's own cells, because it can be pulled past the row
 * it started in.
 */
export function Channel({
  view,
  cells,
  sceneRuns,
  overlaps,
  geometry,
  rowStartSec,
  rowEndSec,
  rowDurationSec,
  dragTargets,
  sceneDragTargets,
  onCutScene,
  wordEdit,
  highlightedSegmentId,
}: ChannelProps) {
  const openedScene = useTimelineOpenedScene();
  const openedTarget = openedScene ? sceneDragTargets.get(openedScene.segmentId) : null;

  if (view === 'scenes') {
    return (
      <div className={CHANNEL_CLASS} style={{ height: geometry.channelHeightPx }}>
        <div
          className={CHIP_BAND_CLASS}
          style={{ top: geometry.chipInsetTopPx, height: geometry.chipHeightPx }}
        >
          <SceneBlockLayer
            sceneRuns={sceneRuns}
            rowStartSec={rowStartSec}
            rowEndSec={rowEndSec}
            rowDurationSec={rowDurationSec}
            sceneDragTargets={sceneDragTargets}
            highlightedSegmentId={highlightedSegmentId}
            openedSegmentId={openedTarget ? openedTarget.segmentId : null}
            onCutScene={onCutScene}
          />
          {openedScene && openedTarget && (
            <OpenedSceneWords
              opened={openedScene}
              toneIndex={openedTarget.toneIndex}
              cells={cells}
              overlaps={overlaps}
              rowStartSec={rowStartSec}
              rowEndSec={rowEndSec}
              rowDurationSec={rowDurationSec}
              dragTargets={dragTargets}
              wordEdit={wordEdit}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={CHANNEL_CLASS} style={{ height: geometry.channelHeightPx }}>
      {/* Before the chips in tree order, so its wash paints behind them. */}
      <SceneRunLayer
        sceneRuns={sceneRuns}
        rowStartSec={rowStartSec}
        rowDurationSec={rowDurationSec}
        highlightedSegmentId={highlightedSegmentId}
      />
      <div
        className={CHIP_BAND_CLASS}
        style={{ top: geometry.chipInsetTopPx, height: geometry.chipHeightPx }}
      >
        <WordChipLayer
          cells={cells}
          overlaps={overlaps}
          rowStartSec={rowStartSec}
          rowEndSec={rowEndSec}
          rowDurationSec={rowDurationSec}
          dragTargetOf={(wordId) => dragTargets.get(wordId)}
          wordEdit={wordEdit}
        />
      </div>
    </div>
  );
}
