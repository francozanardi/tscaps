import { Fragment, memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { DecorationPlacementSide, Line, Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { SegmentView } from '@ui/pages/editor/features/overlay/components/segments/SegmentView';
import { VideoFrameLayer } from '@ui/pages/editor/features/overlay/components/video-frame/VideoFrameLayer';
import { PositionedWordLayer } from '@ui/pages/editor/features/overlay/components/words/PositionedWordLayer';
import { PositionedDecorationLayer } from '@ui/pages/editor/features/overlay/components/words/PositionedDecorationLayer';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useDraggedWordId } from '@ui/pages/editor/features/overlay/hooks/useDraggedWordId';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useSheetOverlayArtifactsBuilder } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useElementAlignmentResolver } from '@ui/pages/editor/contexts/ElementAlignmentContext';


interface ActiveSegmentLayerProps {
  segment: Segment;
  sheet: Sheet;
  segIdx: number;
  elementStyles: ElementStyles;
  decorationOverrides: DecorationOverrideRegistry;
  wrapperVars: Readonly<Record<string, string>>;
  /** Whether the text-behind-actor effect is active on this segment. */
  behindActorActive: boolean;
}

interface PositionedWordEntry {
  word: Word;
  line: Line;
  indexInLine: number;
}

interface PositionedDecorationEntry {
  word: Word;
  line: Line;
  indexInLine: number;
  decorationId: string;
}

const EMPTY_VARS: Readonly<Record<string, string>> = {};

/** One currently-active segment: anchor + wrapper + content, plus sibling layers for words and decoration glyphs whose alignment lives outside the segment's line flow. */
export const ActiveSegmentLayer = memo(function ActiveSegmentLayer({
  segment: sourceSegment,
  sheet,
  segIdx,
  elementStyles,
  decorationOverrides,
  wrapperVars,
  behindActorActive,
}: ActiveSegmentLayerProps) {
  const { wordSplitter, constants } = useEngine();
  const { segmentColorRotation, wordFragmenter, segmentFontStylesBuilder } = useRendering();
  const { decorationPlacementResolver, decorationFilter } = useSheets();
  const segment = useMemo(
    () => decorationFilter.filterSegment(sourceSegment, sheet, decorationOverrides),
    [decorationFilter, sourceSegment, sheet, decorationOverrides],
  );
  const baselineResolver = useElementAlignmentResolver();
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();
  const letterSplitter = sheet.template.rendering.splitWordsIntoLetters ? wordSplitter : null;

  const segmentAlignment = useMemo(
    () => baselineResolver.segmentEffectiveAlignment(sheet, segment.id, elementStyles),
    [baselineResolver, sheet, segment.id, elementStyles],
  );

  const decorationPlacements = useMemo<ReadonlyMap<string, DecorationPlacementSide>>(
    () => decorationPlacementResolver.buildSegmentPlacements(sheet, segment),
    [decorationPlacementResolver, sheet, segment],
  );

  const { horizontalPlacementResolver } = useRendering();
  const alignmentCssBuilder = useMemo(
    () => new AlignmentCssBuilder(horizontalPlacementResolver),
    [horizontalPlacementResolver],
  );

  const anchorStyle = useMemo<CSSProperties>(
    () => alignmentCssBuilder.buildAnchorStyle(segmentAlignment, sheet.textDirection),
    [alignmentCssBuilder, segmentAlignment, sheet.textDirection],
  );

  const videoFrameRequired = sheet.template.rendering.videoFrame.required;
  const segmentAlignmentVars = useMemo<Readonly<Record<string, string>>>(
    () => ({
      ...alignmentCssBuilder.buildAnchorVars(segmentAlignment),
      ...(videoFrameRequired ? alignmentCssBuilder.buildSubtitleRegionVars(segmentAlignment, sheet.textDirection) : EMPTY_VARS),
    }),
    [alignmentCssBuilder, videoFrameRequired, segmentAlignment, sheet.textDirection],
  );

  const colorOverrides = useMemo(
    () => segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx) as CSSProperties,
    [segmentColorRotation, sheet, segment.id, segIdx],
  );
  const segmentFontVars = useMemo(
    () => segmentFontStylesBuilder.buildSegmentFontVars(sheet, segment, elementStyles) as CSSProperties,
    [segmentFontStylesBuilder, sheet, segment, elementStyles],
  );
  const lineFontVars = useMemo(
    () => segmentFontStylesBuilder.buildLineFontVars(sheet, segment, elementStyles) as ReadonlyMap<string, CSSProperties>,
    [segmentFontStylesBuilder, sheet, segment, elementStyles],
  );
  const wordFontFamilies = useMemo(
    () => segmentFontStylesBuilder.buildWordFontFamilies(sheet, segment, elementStyles),
    [segmentFontStylesBuilder, sheet, segment, elementStyles],
  );

  const wrapperBaseStyles = useMemo<CSSProperties>(
    () => ({ ...wrapperVars, ...colorOverrides }),
    [wrapperVars, colorOverrides],
  );

  // Only the main segment element carries the state class: positioned
  // word / decoration layers pin an element at its own anchor, and a
  // template rule reacting to the state (e.g. a lift) would drag it
  // away from that anchor.
  const behindActorStateClasses = useMemo<ReadonlyArray<string>>(
    () => (behindActorActive ? [constants.BEHIND_ACTOR_ACTIVE_CLASS] : []),
    [behindActorActive, constants],
  );

  const supportsSegmentRotation = sheet.template.features.rotation.segment;
  const segmentRotationDeg = elementStyles.fieldNumber(segment.id, ElementFieldId.ROTATION) ?? sheet.rotationConfig.angleDeg;

  const wrapperStyle = useMemo<CSSProperties>(
    () => {
      if (!supportsSegmentRotation) {
        return { ...wrapperBaseStyles, ...segmentAlignmentVars };
      }
      return {
        ...wrapperBaseStyles,
        ...segmentAlignmentVars,
        ['--tscaps-rotation' as string]: '0deg',
        transform: segmentRotationDeg === 0 ? 'none' : `rotate(${segmentRotationDeg}deg)`,
        transformOrigin: 'center',
      };
    },
    [supportsSegmentRotation, wrapperBaseStyles, segmentAlignmentVars, segmentRotationDeg],
  );

  const positionedWords = useMemo<ReadonlyArray<PositionedWordEntry>>(
    () => collectPositionedWords(segment, elementStyles),
    [segment, elementStyles],
  );

  const positionedDecorations = useMemo<ReadonlyArray<PositionedDecorationEntry>>(
    () => collectUserPositionedDecorations(segment, elementStyles),
    [segment, elementStyles],
  );

  // The words the line must leave a gap for are exactly the ones
  // painted at their own anchor. Asking the store a second time would
  // let the two answers disagree and paint a word twice.
  const placedWordIds = useMemo(
    () => new Set(positionedWords.map((entry) => entry.word.id)),
    [positionedWords],
  );

  const draggedWordId = useDraggedWordId();
  const draggedWordPreviewEntry = findDraggedWordInSegment(segment, elementStyles, draggedWordId);
  const draggedDecorationPreviewEntry = findDraggedDecorationInSegment(segment, elementStyles, draggedWordId);

  // A decoration with a user-committed alignment override is painted
  // by `PositionedDecorationLayer` at the chosen viewport coords; a
  // decoration mid-drag follows the cursor through the floating
  // preview layer. Either way it has to leave the segment-side
  // container, or the glyph renders in two places at once.
  const decorationPlacementsForRender = useMemo<ReadonlyMap<string, DecorationPlacementSide>>(
    () => {
      const next = new Map(decorationPlacements);
      for (const entry of positionedDecorations) next.delete(entry.decorationId);
      if (draggedDecorationPreviewEntry) next.delete(draggedDecorationPreviewEntry.decorationId);
      return next;
    },
    [decorationPlacements, positionedDecorations, draggedDecorationPreviewEntry],
  );

  const inlineSuppressedDecorationIds = useMemo(
    () => collectInlineSuppressedDecorationIds(positionedDecorations, decorationPlacements, draggedDecorationPreviewEntry),
    [positionedDecorations, decorationPlacements, draggedDecorationPreviewEntry],
  );

  const videoLayer = useMemo(
    () => (videoFrameRequired && sheet.template.rendering.videoFrame.previewMode === 'live'
      ? <VideoFrameLayer />
      : null),
    [videoFrameRequired, sheet.template.rendering.videoFrame.previewMode],
  );

  const segmentElementRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const manipulationController = useOverlayManipulationController();
  useEffect(() => {
    const segmentElement = segmentElementRef.current;
    const wrapper = wrapperRef.current;
    if (!segmentElement || !wrapper) return;
    return manipulationController.bindSegment({ segmentId: segment.id, sheetId: sheet.id, segment: segmentElement, wrapper });
  }, [manipulationController, segment.id, sheet.id]);

  return (
    <Fragment>
      <div className="subtitle-overlay-anchor" style={anchorStyle}>
        <div
          ref={wrapperRef}
          className={`subtitle-overlay-wrapper ${sheetOverlayArtifactsBuilder.scopeClassFor(sheet.id)}`}
          style={wrapperStyle}
          aria-live="polite"
        >
          <SegmentView
            key={segment.time.start}
            segment={segment}
            indexInSection={segIdx}
            letterSplitter={letterSplitter}
            wordFragmenter={wordFragmenter}
            textDirection={sheet.textDirection}
            wordFontFamilies={wordFontFamilies}
            segmentFontVars={segmentFontVars}
            lineFontVars={lineFontVars}
            inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
            placedWordIds={placedWordIds}
            decorationPlacements={decorationPlacementsForRender}
            layer={videoLayer}
            interactionRef={segmentElementRef}
            extraSegmentClasses={behindActorStateClasses}
          />
        </div>
      </div>
      {positionedWords.map((entry) => (
        <PositionedWordLayer
          key={entry.word.id}
          sheet={sheet}
          segment={segment}
          indexInSection={segIdx}
          line={entry.line}
          word={entry.word}
          indexInLine={entry.indexInLine}
          segmentAlignment={segmentAlignment}
          letterSplitter={letterSplitter}
          fontFamily={wordFontFamilies.get(entry.word.id)}
          wrapperBaseStyles={wrapperBaseStyles}
          inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
        />
      ))}
      {draggedWordPreviewEntry && (
        <PositionedWordLayer
          key={draggedWordPreviewEntry.word.id}
          sheet={sheet}
          segment={segment}
          indexInSection={segIdx}
          line={draggedWordPreviewEntry.line}
          word={draggedWordPreviewEntry.word}
          indexInLine={draggedWordPreviewEntry.indexInLine}
          segmentAlignment={segmentAlignment}
          letterSplitter={letterSplitter}
          fontFamily={wordFontFamilies.get(draggedWordPreviewEntry.word.id)}
          wrapperBaseStyles={wrapperBaseStyles}
          inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
        />
      )}
      {positionedDecorations.map((entry) => (
        <PositionedDecorationLayer
          key={entry.decorationId}
          sheet={sheet}
          segment={segment}
          indexInSection={segIdx}
          line={entry.line}
          word={entry.word}
          segmentAlignment={segmentAlignment}
          wrapperBaseStyles={wrapperBaseStyles}
        />
      ))}
      {draggedDecorationPreviewEntry && (
        <PositionedDecorationLayer
          key={draggedDecorationPreviewEntry.decorationId}
          sheet={sheet}
          segment={segment}
          indexInSection={segIdx}
          line={draggedDecorationPreviewEntry.line}
          word={draggedDecorationPreviewEntry.word}
          segmentAlignment={segmentAlignment}
          wrapperBaseStyles={wrapperBaseStyles}
        />
      )}
    </Fragment>
  );
});

function collectInlineSuppressedDecorationIds(
  positionedDecorations: ReadonlyArray<PositionedDecorationEntry>,
  placements: ReadonlyMap<string, DecorationPlacementSide>,
  draggedDecoration: PositionedDecorationEntry | null,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entry of positionedDecorations) ids.add(entry.decorationId);
  for (const decorationId of placements.keys()) ids.add(decorationId);
  if (draggedDecoration) ids.add(draggedDecoration.decorationId);
  return ids;
}

function collectPositionedWords(segment: Segment, elementStyles: ElementStyles): PositionedWordEntry[] {
  const out: PositionedWordEntry[] = [];
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (elementStyles.placementOf(word.id)) out.push({ word, line, indexInLine });
    }
  }
  return out;
}

function collectUserPositionedDecorations(
  segment: Segment,
  elementStyles: ElementStyles,
): PositionedDecorationEntry[] {
  const out: PositionedDecorationEntry[] = [];
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (!word.decoration) continue;
      const decorationId = word.decoration.id;
      if (elementStyles.placementOf(decorationId)) out.push({ word, line, indexInLine, decorationId });
    }
  }
  return out;
}

function findDraggedDecorationInSegment(
  segment: Segment,
  elementStyles: ElementStyles,
  draggedWordId: string | null,
): PositionedDecorationEntry | null {
  if (!draggedWordId) return null;
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (!word.decoration) continue;
      if (word.decoration.id !== draggedWordId) continue;
      // A user-committed alignment override already paints the
      // decoration through the positioned layer that follows the
      // cursor on its own; only currently-in-flow glyphs (inline or in
      // a segment-side container) need the temporary preview entry.
      if (elementStyles.placementOf(draggedWordId)) return null;
      return { word, line, indexInLine, decorationId: draggedWordId };
    }
  }
  return null;
}

function findDraggedWordInSegment(
  segment: Segment,
  elementStyles: ElementStyles,
  draggedWordId: string | null,
): PositionedWordEntry | null {
  if (!draggedWordId) return null;
  if (elementStyles.placementOf(draggedWordId)) return null;
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (word.id === draggedWordId) return { word, line, indexInLine };
    }
  }
  return null;
}

