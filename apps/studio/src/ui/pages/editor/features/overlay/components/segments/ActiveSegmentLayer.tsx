import { Fragment, memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { DecorationPlacementSide, Line, Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
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
import { useWordStyleBaselineResolver } from '@ui/pages/editor/contexts/WordStyleBaselineContext';

const alignmentCssBuilder = new AlignmentCssBuilder();

interface ActiveSegmentLayerProps {
  segment: Segment;
  sheet: Sheet;
  segIdx: number;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  wrapperVars: Readonly<Record<string, string>>;
  /** Text-behind-actor state variables for this segment; empty when the segment publishes none. */
  behindActorVars: Readonly<Record<string, string>>;
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
  wordStyleOverrides,
  segmentOverrides,
  decorationOverrides,
  wrapperVars,
  behindActorVars,
}: ActiveSegmentLayerProps) {
  const { wordSplitter } = useEngine();
  const { segmentColorRotation } = useRendering();
  const { decorationPlacementResolver, decorationFilter } = useSheets();
  const segment = useMemo(
    () => decorationFilter.filterSegment(sourceSegment, sheet, decorationOverrides),
    [decorationFilter, sourceSegment, sheet, decorationOverrides],
  );
  const baselineResolver = useWordStyleBaselineResolver();
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();
  const letterSplitter = sheet.template.rendering.splitWordsIntoLetters ? wordSplitter : null;

  const segmentAlignment = useMemo(
    () => baselineResolver.segmentEffectiveAlignment(sheet, segment.id, segmentOverrides),
    [baselineResolver, sheet, segment.id, segmentOverrides],
  );

  const decorationPlacements = useMemo<ReadonlyMap<string, DecorationPlacementSide>>(
    () => decorationPlacementResolver.buildSegmentPlacements(sheet, segment),
    [decorationPlacementResolver, sheet, segment],
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

  // Deliberately excludes the behind-actor vars: the positioned word /
  // decoration layers inherit these base styles, and a user-pinned
  // element must hold its exact position — the template's lift reacts
  // to the vars and would drag it away from its anchor.
  const wrapperBaseStyles = useMemo<CSSProperties>(
    () => ({ ...wrapperVars, ...colorOverrides, ...segmentInlineStyleOverrides }),
    [wrapperVars, colorOverrides, segmentInlineStyleOverrides],
  );

  const supportsSegmentRotation = sheet.template.features.rotation.segment;
  const segmentRotationDeg = segmentOverrides.getStyle(segment.id).rotation ?? sheet.rotationConfig.angleDeg;

  // The behind-actor lift rides the wrapper, not `.segment`, so the
  // hitzone (and with it clicks, the popover anchor, drags, and the
  // selection chrome) moves with the visible text — hit-testing
  // follows the wrapper's transform, while a template-level translate
  // on `.segment` would leave every interaction box at the un-lifted
  // spot. Cost: the translate makes the wrapper a stacking context
  // while the effect is on, which keeps descendant `mix-blend-mode`
  // from reaching the live video for those segments.
  const behindActorLift = useMemo<CSSProperties>(
    () => {
      const effectOn = sheet.template.rendering.behindActor.required
        && Object.keys(behindActorVars).length > 0;
      if (!effectOn) return EMPTY_VARS;
      return { translate: '0 calc(var(--tscaps-behind-lift, 0px) * -1)' };
    },
    [sheet.template.rendering.behindActor.required, behindActorVars],
  );

  const wrapperStyle = useMemo<CSSProperties>(
    () => {
      if (!supportsSegmentRotation) {
        return { ...wrapperBaseStyles, ...behindActorVars, ...behindActorLift, ...segmentSubtitleRegionVars };
      }
      return {
        ...wrapperBaseStyles,
        ...behindActorVars,
        ...behindActorLift,
        ...segmentSubtitleRegionVars,
        ['--tscaps-rotation' as string]: '0deg',
        transform: segmentRotationDeg === 0 ? 'none' : `rotate(${segmentRotationDeg}deg)`,
        transformOrigin: 'center',
      };
    },
    [supportsSegmentRotation, wrapperBaseStyles, behindActorVars, behindActorLift, segmentSubtitleRegionVars, segmentRotationDeg],
  );

  const positionedWords = useMemo<ReadonlyArray<PositionedWordEntry>>(
    () => collectPositionedWords(segment, wordStyleOverrides),
    [segment, wordStyleOverrides],
  );

  const positionedDecorations = useMemo<ReadonlyArray<PositionedDecorationEntry>>(
    () => collectUserPositionedDecorations(segment, wordStyleOverrides),
    [segment, wordStyleOverrides],
  );

  const draggedWordId = useDraggedWordId();
  const draggedWordPreviewEntry = findDraggedWordInSegment(segment, wordStyleOverrides, draggedWordId);
  const draggedDecorationPreviewEntry = findDraggedDecorationInSegment(segment, wordStyleOverrides, draggedWordId);

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

  const hitzoneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const manipulationController = useOverlayManipulationController();
  useEffect(() => {
    const hitzone = hitzoneRef.current;
    const wrapper = wrapperRef.current;
    if (!hitzone || !wrapper) return;
    return manipulationController.bindSegment({ segmentId: segment.id, hitzone, wrapper });
  }, [manipulationController, segment.id]);

  return (
    <Fragment>
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
          >
            <SegmentView
              key={segment.time.start}
              segment={segment}
              indexInSection={segIdx}
              letterSplitter={letterSplitter}
              wordStyleOverrides={wordStyleOverrides}
              inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
              decorationPlacements={decorationPlacementsForRender}
              layer={videoLayer}
            />
          </div>
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
          wordStyleOverrides={wordStyleOverrides}
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
          wordStyleOverrides={wordStyleOverrides}
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
          wordStyleOverrides={wordStyleOverrides}
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
          wordStyleOverrides={wordStyleOverrides}
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

function collectPositionedWords(segment: Segment, overrides: WordStyleOverrideRegistry): PositionedWordEntry[] {
  const out: PositionedWordEntry[] = [];
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (overrides.hasAlignmentOverride(word.id)) out.push({ word, line, indexInLine });
    }
  }
  return out;
}

function collectUserPositionedDecorations(
  segment: Segment,
  overrides: WordStyleOverrideRegistry,
): PositionedDecorationEntry[] {
  const out: PositionedDecorationEntry[] = [];
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (!word.decoration) continue;
      const decorationId = word.decoration.id;
      if (overrides.hasAlignmentOverride(decorationId)) out.push({ word, line, indexInLine, decorationId });
    }
  }
  return out;
}

function findDraggedDecorationInSegment(
  segment: Segment,
  overrides: WordStyleOverrideRegistry,
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
      if (overrides.hasAlignmentOverride(draggedWordId)) return null;
      return { word, line, indexInLine, decorationId: draggedWordId };
    }
  }
  return null;
}

function findDraggedWordInSegment(
  segment: Segment,
  overrides: WordStyleOverrideRegistry,
  draggedWordId: string | null,
): PositionedWordEntry | null {
  if (!draggedWordId) return null;
  if (overrides.hasAlignmentOverride(draggedWordId)) return null;
  for (const line of segment.lines) {
    for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
      const word = line.words[indexInLine]!;
      if (word.id === draggedWordId) return { word, line, indexInLine };
    }
  }
  return null;
}

