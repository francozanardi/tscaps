import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineRow, TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import type { TimelineWordDragTargets } from '@presentation/timeline/services/TimelineWordDragTargets';
import type { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import type { TimelineWaveformData } from '@presentation/timeline/controllers/TimelineWaveformController';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import { pointerOrigin, sceneCellId } from '@ui/pages/editor/features/timeline/utils';
import { useRowGeometryGuard } from '@ui/pages/editor/features/timeline/hooks/useRowGeometryGuard';
import { TimelineScenePointerResolver } from '@presentation/timeline/services/TimelineScenePointerResolver';
import { useTimelineCellHoverController } from '@ui/pages/editor/features/timeline/contexts/TimelineCellHoverContext';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { Channel } from '@ui/pages/editor/features/timeline/components/Channel';
import { TimeRuler } from '@ui/pages/editor/features/timeline/components/TimeRuler';
import { Waveform } from '@ui/pages/editor/features/timeline/components/Waveform';
import { CutOverlay } from '@ui/pages/editor/features/timeline/components/overlays/CutOverlay';
import { RowSelectionLayer } from '@ui/pages/editor/features/timeline/components/overlays/RowSelectionLayer';
import { SilenceLayer } from '@ui/pages/editor/features/timeline/components/overlays/SilenceLayer';
import { useTimelineCutEditInRow, useTimelineWordEditInRow } from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { HoverCursor } from '@ui/pages/editor/features/timeline/components/overlays/HoverCursor';
import { PlaybackCursor } from '@ui/pages/editor/features/timeline/components/overlays/PlaybackCursor';

// Filled, so a row is an object rather than a run of similar strips:
// rows differ in height, and stacked strips of the same weight compete
// with one another however they are spaced. The fill is what says
// "these parts, and no others, are one row".
//
// Every gap and height below comes from the row's geometry rather than
// from a utility class, because that same geometry is what the
// virtualizer reserves space with. A class carrying one of these
// numbers could drift from it, and the row would be drawn at a size
// nothing had reserved.
const ROW_CLASS = 'flex flex-col bg-surface-3/55 rounded-md';

// `touch-pan-y` lets the browser scroll the surrounding list when a
// touch drag is vertical-dominant; horizontal drags are handled by the
// drag controller once the gesture resolver picks the dominant axis.
//
// The ruler is inside this zone rather than above it, and has to be: a
// pointer is matched to the last row whose top it has passed, so a band
// sitting outside the bound element answers as the row *above* — the
// ruler would have scrubbed the wrong row. Being inside also shrinks
// the dead band between one row and the next by its own height.
const INTERACTION_ZONE_CLASS = 'flex flex-col touch-pan-y select-none cursor-crosshair';

// No surface of its own: the channel is the surface and the row shows
// through around it.
//
// `isolate` keeps the track's internal layering to itself. Chips raise
// their resize handles so both are reachable where two words cross, and
// without a stacking context of its own that z-index reaches out and
// beats the overlays — letting a handle be grabbed through the mask of
// a cut that covers it.
const TRACK_CLASS = 'isolate';

const WAVEFORM_TRACK_CLASS = 'bg-surface-1 ring-1 ring-inset ring-edge-medium rounded-sm overflow-hidden';

// The app's "working" blink, on a flat line where the bars will be.
const WAVEFORM_LOADING_LINE_CLASS =
  'absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[rgb(var(--color-waveform))] '
  + 'animate-dot-blink motion-reduce:animate-none motion-reduce:opacity-50';

const OVERLAY_LAYER_CLASS = 'pointer-events-none';

const sceneResolver = new TimelineScenePointerResolver();

interface RowProps {
  row: TimelineRow;
  view: TimelineView;
  /** Every vertical measurement, shared with whatever reserved space for this row. */
  geometry: TimelineRowGeometry;
  cuts: ReadonlyArray<CutRange>;
  waveform: TimelineWaveformData | null;
  /** The strip is asked for and its audio is still being read. */
  waveformLoading: boolean;
  dragTargets: TimelineWordDragTargets;
  sceneDragTargets: TimelineSceneDragTargets;
  onCutScene: (startSec: number, endSec: number) => void;
  highlightedSegmentId: string | null;
  onRestoreRange: (range: CutRange) => void;
}

/**
 * One slice of the video's clock: a horizontal track carrying the words
 * that play during it, an optional waveform strip, and the overlays for
 * cuts, selection, playhead and hover.
 *
 * Every row of a timeline covers the same span and fills the same
 * width, so one second is worth the same pixels wherever it is drawn —
 * which is what lets a drag mean the same thing in every row.
 *
 * The row publishes its element and time bounds so the drag controller
 * can resolve a pointer anywhere over the timeline, and hands presses
 * on its own surface to that controller. It deliberately does not
 * follow the pointer afterwards: a gesture can leave this row, and the
 * row itself can be recycled while the gesture is still running.
 */
export const Row = memo(function Row({
  row,
  view,
  geometry,
  cuts,
  waveform,
  waveformLoading,
  dragTargets,
  sceneDragTargets,
  onCutScene,
  highlightedSegmentId,
  onRestoreRange,
}: RowProps) {
  const rowDurationSec = row.endSec - row.startSec;
  const controller = useTimelineEditingController();
  const dragController = useTimelinePointerDragController();
  const hoverController = useTimelineCellHoverController();
  const rowRef = useRowGeometryGuard(row.index, geometry.cardHeightPx);
  const zoneRef = useRef<HTMLDivElement>(null);
  const pointedSceneRef = useRef<string | null>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  // A cut being resized is drawn wherever its *preview* reaches, which
  // is a row its stored range may not touch at all. Filtering on the
  // stored range alone left the mask missing from the row the pointer
  // had dragged into, and appearing there only on release.
  const cutEdit = useTimelineCutEditInRow(row.startSec, row.endSec);
  const cutsInRange = cuts.filter((cut) => (
    cut === cutEdit?.originalRange || (cut.endSec > row.startSec && cut.startSec < row.endSec)
  ));
  const wordEdit = useTimelineWordEditInRow(row.startSec, row.endSec);

  useEffect(() => {
    const element = zoneRef.current;
    if (!element) return;
    return dragController.bindRow({
      index: row.index,
      startSec: row.startSec,
      endSec: row.endSec,
      element,
    });
  }, [dragController, row.index, row.startSec, row.endSec]);

  const selectCellRange = (startSec: number, endSec: number) => {
    controller.selectRange(startSec, endSec);
  };

  // A row torn off the screen while the pointer was on one of its scenes
  // would otherwise leave it lit for good: a removed element is never
  // told the pointer left it.
  useEffect(() => () => {
    const segmentId = pointedSceneRef.current;
    if (segmentId) hoverController.clear(sceneCellId(segmentId));
  }, [hoverController]);

  const sceneAt = (e: ReactPointerEvent<HTMLDivElement>, fraction: number) => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return sceneResolver.resolve(row, geometry, fraction, e.clientY - rect.top);
  };

  const fractionAt = (e: ReactPointerEvent<HTMLDivElement>): number | null => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  // In the capture phase, so it still runs for presses the layers above
  // handle themselves. Whoever takes the press, the pointer is about to
  // be captured elsewhere and this row stops hearing about it, which
  // would leave its hover line frozen where the press landed.
  const clearHoverLine = () => setHoverFraction(null);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragController.beginRangeDrag(pointerOrigin(e));
  };

  /**
   * Bound to entering as well as moving, so a gesture that ends over a
   * different row hands the hover over without waiting for the hand to
   * move again.
   *
   */
  const trackPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const fraction = fractionAt(e);
    if (fraction === null) return;
    setHoverFraction(fraction);
    pointAtScene(sceneAt(e, fraction));
  };

  const isPointerInside = (e: ReactPointerEvent<HTMLDivElement>): boolean => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
  };

  // Capturing the pointer hands every event to the capture target, and
  // the browser announces that by telling this row the pointer left it.
  // It did not: a press starts a gesture without the hand going
  // anywhere, so acting on that leave darkens the scene under a cursor
  // still sitting inside it. Only a leave that really is one counts,
  // which is the one where the pointer ends up outside.
  const handlePointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isPointerInside(e)) return;
    setHoverFraction(null);
    pointAtScene(null);
  };

  // The scene under the pointer is announced by the row rather than
  // claimed by each bar, because a bar sits behind the words and
  // silences it holds and so is almost never the element the pointer is
  // actually over.
  //
  const pointAtScene = (run: TimelineSceneRun | null) => {
    const segmentId = run?.segmentId ?? null;
    const previous = pointedSceneRef.current;
    if (segmentId === previous) return;
    if (previous) hoverController.clear(sceneCellId(previous));
    if (segmentId) hoverController.hover(sceneCellId(segmentId));
    pointedSceneRef.current = segmentId;
  };

  return (
    <div
      ref={rowRef}
      className={ROW_CLASS}
      style={{
        gap: geometry.innerGapPx,
        padding: geometry.paddingPx,
        marginBottom: geometry.spacingPx,
      }}
    >
      <div
        ref={zoneRef}
        className={INTERACTION_ZONE_CLASS}
        style={{ position: 'relative', width: '100%', gap: geometry.innerGapPx }}
        onPointerDownCapture={clearHoverLine}
        onPointerDown={handlePointerDown}
        onPointerEnter={trackPointer}
        onPointerMove={trackPointer}
        onPointerLeave={handlePointerLeave}
      >
        <TimeRuler
          rowStartSec={row.startSec}
          rowDurationSec={rowDurationSec}
          heightPx={geometry.headerHeightPx}
        />
        <div
          className={TRACK_CLASS}
          style={{
            position: 'relative',
            width: '100%',
            height: geometry.trackHeightPx,
          }}
        >
          {/* Spans the track's full width: every layer of the row has to
              turn a time into the same x, or they drift apart at the edges. */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: geometry.trackPaddingPx,
              bottom: geometry.trackPaddingPx,
            }}
          >
            <Channel
              view={view}
              cells={row.cells}
              sceneRuns={row.sceneRuns}
              overlaps={row.overlaps}
              geometry={geometry}
              rowStartSec={row.startSec}
              rowEndSec={row.endSec}
              rowDurationSec={rowDurationSec}
              dragTargets={dragTargets}
              sceneDragTargets={sceneDragTargets}
              onCutScene={onCutScene}
              wordEdit={wordEdit}
              highlightedSegmentId={highlightedSegmentId}
            />
            {/* After the channel, so a silence cuts the scene wash behind
                it rather than being tinted by it. Only at the word level:
                a silence is a gap between words, and the scene level does
                not draw words for it to sit between. */}
            {view === 'words' && (
              <SilenceLayer
                silences={row.silences}
                geometry={geometry}
                rowStartSec={row.startSec}
                rowDurationSec={rowDurationSec}
                onSelect={selectCellRange}
              />
            )}
          </div>
        </div>
        {!waveform && waveformLoading && (
          <div
            className={`${WAVEFORM_TRACK_CLASS} relative`}
            style={{ width: '100%', height: geometry.waveformHeightPx }}
            aria-hidden
          >
            <div className={WAVEFORM_LOADING_LINE_CLASS} />
          </div>
        )}
        {waveform && (
          <div className={WAVEFORM_TRACK_CLASS} style={{ width: '100%' }}>
            <Waveform
              peaks={waveform.peaks}
              peaksPerSecond={waveform.peaksPerSecond}
              startSec={row.startSec}
              endSec={row.endSec}
              heightPx={geometry.waveformHeightPx}
              scale={waveform.scale}
            />
          </div>
        )}
        <div className={OVERLAY_LAYER_CLASS} style={{ position: 'absolute', inset: 0 }}>
          {cutsInRange.map((cut, index) => (
            <CutOverlay
              key={`cut-${index}-${cut.startSec.toFixed(3)}`}
              cut={cut}
              rowStartSec={row.startSec}
              rowDurationSec={rowDurationSec}
              onRestore={() => onRestoreRange(cut)}
            />
          ))}
          <RowSelectionLayer rowStartSec={row.startSec} rowEndSec={row.endSec} />
          <PlaybackCursor rowStartSec={row.startSec} rowEndSec={row.endSec} />
          {hoverFraction !== null && <HoverCursor fraction={hoverFraction} />}
        </div>
      </div>
    </div>
  );
});
