import { memo, useMemo, type CSSProperties } from 'react';
import { useOverlayManipulationController } from '@ui/editor/components/overlay/OverlayManipulationContext';
import { useOverlayDragState } from '@ui/editor/components/overlay/useOverlayDragState';

/**
 * Visual snap guides drawn over the video while a drag is in progress.
 * For a segment drag, renders 3 horizontal + 3 vertical bands and
 * highlights whichever the drag has snapped to. For a word drag, only
 * the horizontal-center vertical line is drawn (the only weighted
 * guide for words) and highlights when snapped. Renders nothing when
 * no drag is in progress.
 */
export const SnapGuides = memo(function SnapGuides() {
  const dragState = useOverlayDragState();
  if (!dragState) return null;
  if (dragState.kind === 'segment') return <SegmentSnapGuides />;
  return <WordSnapGuides />;
});

const SegmentSnapGuides = memo(function SegmentSnapGuides() {
  const controller = useOverlayManipulationController();
  const dragState = useOverlayDragState();
  const verticalGuides = useMemo(() => controller.verticalGuides(), [controller]);
  const horizontalGuides = useMemo(() => controller.horizontalGuides(), [controller]);

  if (!dragState || dragState.kind !== 'segment') return null;

  const activeVerticalCenter = dragState.vertical.snapped ? dragState.vertical.snappedBandCenter : null;
  const activeHorizontalCenter = dragState.horizontal.snapped ? dragState.horizontal.snappedBandCenter : null;

  return (
    <div className="subtitle-overlay-snap-guides" aria-hidden>
      {verticalGuides.map((guide) => (
        <div
          key={`v-${guide.center}`}
          className={horizontalLineClass(guide.center === activeVerticalCenter)}
          style={topPercentStyle(guide.center)}
        />
      ))}
      {horizontalGuides.map((guide) => (
        <div
          key={`h-${guide.center}`}
          className={verticalLineClass(guide.center === activeHorizontalCenter)}
          style={leftPercentStyle(guide.center)}
        />
      ))}
    </div>
  );
});

const WordSnapGuides = memo(function WordSnapGuides() {
  const controller = useOverlayManipulationController();
  const dragState = useOverlayDragState();
  const guide = useMemo(() => controller.wordCenterGuide(), [controller]);

  if (!dragState || dragState.kind !== 'word') return null;

  return (
    <div className="subtitle-overlay-snap-guides" aria-hidden>
      <div
        className={verticalLineClass(dragState.horizontalSnap)}
        style={leftPercentStyle(guide.center)}
      />
    </div>
  );
});

function horizontalLineClass(active: boolean): string {
  return `subtitle-overlay-snap-guide subtitle-overlay-snap-guide-horizontal${active ? ' is-active' : ''}`;
}

function verticalLineClass(active: boolean): string {
  return `subtitle-overlay-snap-guide subtitle-overlay-snap-guide-vertical${active ? ' is-active' : ''}`;
}

function topPercentStyle(fraction: number): CSSProperties {
  return { top: `${fraction * 100}%` };
}

function leftPercentStyle(fraction: number): CSSProperties {
  return { left: `${fraction * 100}%` };
}
