import { Fragment, memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Line, Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import { SegmentView } from '@ui/editor/components/overlay/SegmentView';
import { VideoFrameLayer } from '@ui/editor/components/overlay/VideoFrameLayer';
import { PositionedWordLayer } from '@ui/editor/components/overlay/PositionedWordLayer';
import { useOverlayManipulationController } from '@ui/editor/components/overlay/OverlayManipulationContext';
import { useDraggedWordId } from '@ui/editor/components/overlay/useDraggedWordId';
import { useIsDropTargetSegment } from '@ui/editor/components/overlay/useIsDropTargetSegment';
import { ManipulationHandles } from '@ui/editor/components/overlay/ManipulationHandles';
import { SegmentRotateHandle } from '@ui/editor/components/overlay/SegmentRotateHandle';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useSheetOverlayArtifactsBuilder } from '@ui/editor/contexts/SheetOverlayArtifactsContext';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useWordStyleBaselineResolver } from '@ui/editor/contexts/WordStyleBaselineContext';

const alignmentCssBuilder = new AlignmentCssBuilder();

interface ActiveSegmentLayerProps {
  segment: Segment;
  sheet: Sheet;
  segIdx: number;
  isSelected: boolean;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  wrapperVars: Readonly<Record<string, string>>;
}

interface PositionedWordEntry {
  word: Word;
  line: Line;
}

const EMPTY_VARS: Readonly<Record<string, string>> = {};

/** One currently-active segment: anchor + wrapper + content. Words with a per-word alignment override are rendered twice — invisible placeholder in flow and a visible `PositionedWordLayer` sibling at the word's anchor. */
export const ActiveSegmentLayer = memo(function ActiveSegmentLayer({
  segment,
  sheet,
  segIdx,
  isSelected,
  wordStyleOverrides,
  segmentOverrides,
  wrapperVars,
}: ActiveSegmentLayerProps) {
  const { wordSplitter } = useEngine();
  const { segmentColorRotation } = useRendering();
  const baselineResolver = useWordStyleBaselineResolver();
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();
  const letterSplitter = sheet.template.rendering.splitWordsIntoLetters ? wordSplitter : null;

  const segmentAlignment = useMemo(
    () => baselineResolver.segmentEffectiveAlignment(sheet, segment.id, segmentOverrides),
    [baselineResolver, sheet, segment.id, segmentOverrides],
  );

  const anchorStyle = useMemo<CSSProperties>(
    () => alignmentCssBuilder.buildAnchorStyle(segmentAlignment),
    [segmentAlignment],
  );

  const videoFrameRequired = sheet.template.rendering.videoFrame.required;
  const segmentSubtitleRegionVars = useMemo<Readonly<Record<string, string>>>(
    () => videoFrameRequired ? alignmentCssBuilder.buildSubtitleRegionVars(segmentAlignment) : EMPTY_VARS,
    [videoFrameRequired, segmentAlignment],
  );

  const colorOverrides = useMemo(
    () => segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx) as CSSProperties,
    [segmentColorRotation, sheet, segment.id, segIdx],
  );
  const segmentInlineStyleOverrides = useMemo(
    () => segmentOverrides.buildInlineStyles(segment.id) as CSSProperties,
    [segmentOverrides, segment.id],
  );

  // Without alignment-dependent vars — positioned-word siblings layer their own on top.
  const wrapperBaseStyles = useMemo<CSSProperties>(
    () => ({ ...wrapperVars, ...colorOverrides, ...segmentInlineStyleOverrides }),
    [wrapperVars, colorOverrides, segmentInlineStyleOverrides],
  );

  const supportsSegmentRotation = sheet.template.features.rotation.segment;
  const segmentRotationDeg = segmentOverrides.getStyle(segment.id).rotation ?? sheet.rotationConfig.angleDeg;

  const wrapperStyle = useMemo<CSSProperties>(
    () => {
      if (!supportsSegmentRotation) {
        return { ...wrapperBaseStyles, ...segmentSubtitleRegionVars };
      }
      return {
        ...wrapperBaseStyles,
        ...segmentSubtitleRegionVars,
        ['--tscaps-rotation' as string]: '0deg',
        transform: segmentRotationDeg === 0 ? 'none' : `rotate(${segmentRotationDeg}deg)`,
        transformOrigin: 'center',
      };
    },
    [supportsSegmentRotation, wrapperBaseStyles, segmentSubtitleRegionVars, segmentRotationDeg],
  );

  const positionedWords = useMemo<ReadonlyArray<PositionedWordEntry>>(
    () => collectPositionedWords(segment, wordStyleOverrides),
    [segment, wordStyleOverrides],
  );

  // A word being actively dragged (but without a saved override yet)
  // must also render as a positioned-word sibling so it leaves the
  // segment's filter / clip region. Already-overridden words appear
  // in `positionedWords` and pick up the preview alignment inside
  // `PositionedWordLayer`.
  const draggedWordId = useDraggedWordId();
  const draggedWordPreviewEntry = findDraggedWordInSegment(segment, wordStyleOverrides, draggedWordId);
  const isReturnDropTarget = useIsDropTargetSegment(segment.id);

  const videoLayer = useMemo(
    () => (videoFrameRequired && sheet.template.rendering.videoFrame.previewMode === 'live'
      ? <VideoFrameLayer />
      : null),
    [videoFrameRequired, sheet.template.rendering.videoFrame.previewMode],
  );

  // The segment is rendered only when it has visible words — otherwise
  // its template-defined decorations (background, padding, ::before
  // title bars) would paint as a ghost shell once every word has been
  // moved out of flow. Positioned-word siblings still render below.
  const segmentHasVisibleWords = countVisibleWords(segment, wordStyleOverrides, draggedWordId) > 0;
  const hitzoneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const manipulationController = useOverlayManipulationController();
  useEffect(() => {
    if (!segmentHasVisibleWords) return;
    const hitzone = hitzoneRef.current;
    const wrapper = wrapperRef.current;
    if (!hitzone || !wrapper) return;
    return manipulationController.bindSegment({ segmentId: segment.id, hitzone, wrapper });
  }, [manipulationController, segment.id, segmentHasVisibleWords]);

  return (
    <Fragment>
      {segmentHasVisibleWords && (
        <div className="subtitle-overlay-anchor" style={anchorStyle}>
          <div
            ref={wrapperRef}
            className={`subtitle-overlay-wrapper ${sheetOverlayArtifactsBuilder.scopeClassFor(sheet.id)}`}
            style={wrapperStyle}
            aria-live="polite"
          >
            <div
              ref={hitzoneRef}
              className="subtitle-overlay-segment-hitzone"
              data-tscaps-segment-id={segment.id}
              data-tscaps-selected={isSelected ? '' : undefined}
              data-tscaps-drop-target={isReturnDropTarget ? '' : undefined}
            >
              <SegmentView
                key={segment.time.start}
                segment={segment}
                letterSplitter={letterSplitter}
                wordStyleOverrides={wordStyleOverrides}
                layer={videoLayer}
              />
              {isSelected && <ManipulationHandles segmentId={segment.id} />}
              {isSelected && supportsSegmentRotation && <SegmentRotateHandle segmentId={segment.id} />}
            </div>
          </div>
        </div>
      )}
      {positionedWords.map((entry) => (
        <PositionedWordLayer
          key={entry.word.id}
          sheet={sheet}
          segment={segment}
          line={entry.line}
          word={entry.word}
          segmentAlignment={segmentAlignment}
          letterSplitter={letterSplitter}
          wordStyleOverrides={wordStyleOverrides}
          wrapperBaseStyles={wrapperBaseStyles}
        />
      ))}
      {draggedWordPreviewEntry && (
        <PositionedWordLayer
          key={draggedWordPreviewEntry.word.id}
          sheet={sheet}
          segment={segment}
          line={draggedWordPreviewEntry.line}
          word={draggedWordPreviewEntry.word}
          segmentAlignment={segmentAlignment}
          letterSplitter={letterSplitter}
          wordStyleOverrides={wordStyleOverrides}
          wrapperBaseStyles={wrapperBaseStyles}
        />
      )}
    </Fragment>
  );
});

function collectPositionedWords(segment: Segment, overrides: WordStyleOverrideRegistry): PositionedWordEntry[] {
  const out: PositionedWordEntry[] = [];
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (overrides.hasAlignmentOverride(word.id)) out.push({ word, line });
    }
  }
  return out;
}

function findDraggedWordInSegment(
  segment: Segment,
  overrides: WordStyleOverrideRegistry,
  draggedWordId: string | null,
): PositionedWordEntry | null {
  if (!draggedWordId) return null;
  if (overrides.hasAlignmentOverride(draggedWordId)) return null;
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (word.id === draggedWordId) return { word, line };
    }
  }
  return null;
}

function countVisibleWords(
  segment: Segment,
  overrides: WordStyleOverrideRegistry,
  draggedWordId: string | null,
): number {
  let count = 0;
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (overrides.hasAlignmentOverride(word.id)) continue;
      if (word.id === draggedWordId) continue;
      count++;
    }
  }
  return count;
}
