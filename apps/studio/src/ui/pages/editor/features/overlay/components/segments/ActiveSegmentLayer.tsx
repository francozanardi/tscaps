import { Fragment, memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { CaptionBlendMode, CaptionLayer, CaptionStacking, DecorationPlacementSide, Line, Segment, SubtreeIsolationMarks, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { SegmentView } from '@ui/pages/editor/features/overlay/components/segments/SegmentView';
import { IsolatedSegmentCopy } from '@ui/pages/editor/features/overlay/components/segments/IsolatedSegmentCopy';
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
import { IsolationMarksProvider, subtreeIsolationMarksFactory } from '@ui/pages/editor/features/overlay/contexts/IsolationMarksContext';


interface ActiveSegmentLayerProps {
  segment: Segment;
  sheet: Sheet;
  segIdx: number;
  elementStyles: ElementStyles;
  decorationOverrides: DecorationOverrideRegistry;
  wrapperVars: Readonly<Record<string, string>>;
  /** Whether the text-behind-actor effect is active on this segment. */
  behindActorActive: boolean;
  /** Words and glyphs behind the actor in a scene that is not; across the document, read for this segment's own. */
  elementsUnderTopLayer: ReadonlySet<string>;
  /** The side of the actor cutout this layer is stacked on: it mounts only the subtrees stacked there. */
  stacking: CaptionStacking;
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

/** One copy of the segment subtree painting only the elements an isolation keeps. */
interface IsolatedCopy {
  readonly key: string;
  readonly marks: SubtreeIsolationMarks;
  readonly wrapperStyle: CSSProperties;
}

/**
 * One currently-active segment, on one side of the actor cutout: anchor
 * + wrapper + content, plus sibling layers for words and decoration
 * glyphs whose alignment lives outside the segment's line flow, and the
 * isolated copies of elements painted apart. Mounted once per side; each
 * subtree mounts in exactly one of them, the one the engine's decomposer
 * assigns it to.
 */
export const ActiveSegmentLayer = memo(function ActiveSegmentLayer({
  segment: sourceSegment,
  sheet,
  segIdx,
  elementStyles,
  decorationOverrides,
  wrapperVars,
  behindActorActive,
  elementsUnderTopLayer,
  stacking,
}: ActiveSegmentLayerProps) {
  const { wordSplitter, constants } = useEngine();
  const {
    segmentColorRotation,
    wordFragmenter,
    segmentFontStylesBuilder,
    segmentSubtreeDecomposer,
    segmentSubtreeOverridesBuilder,
  } = useRendering();

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
  const holdsElementUnderActor = segment.lines.some((line) => line.words.some((word) =>
    elementsUnderTopLayer.has(word.id) || (word.decoration !== null && elementsUnderTopLayer.has(word.decoration.id))));
  const behindActorStateClasses = useMemo<ReadonlyArray<string>>(
    () => {
      if (behindActorActive) return [constants.BEHIND_ACTOR_ACTIVE_CLASS];
      return holdsElementUnderActor ? [constants.BEHIND_ACTOR_PARTIAL_CLASS] : [];
    },
    [behindActorActive, holdsElementUnderActor, constants],
  );

  const supportsSegmentRotation = sheet.template.features.rotation.segment;
  const segmentRotationDeg = elementStyles.fieldNumber(segment.id, ElementFieldId.ROTATION) ?? sheet.rotationConfig.angleDeg;

  // The same split into subtrees the export makes, asked of the same
  // decomposer: which elements are painted by isolated copies, and the
  // layer each subtree paints in.
  const subtreeOverrides = useMemo(
    () => segmentSubtreeOverridesBuilder.build(segment, elementStyles, elementsUnderTopLayer),
    [segmentSubtreeOverridesBuilder, segment, elementStyles, elementsUnderTopLayer],
  );
  const decomposition = useMemo(
    () => segmentSubtreeDecomposer.decompose(segment, subtreeOverrides.subtree, decorationPlacements, subtreeOverrides.segment),
    [segmentSubtreeDecomposer, segment, subtreeOverrides, decorationPlacements],
  );
  const segmentLayer = decomposition.segmentLayer;
  const rendersMain = segmentLayer.stacking === stacking;
  const elementLayerOf = (elementId: string): CaptionLayer =>
    segmentSubtreeDecomposer.elementLayerOf(elementId, subtreeOverrides.subtree, segmentLayer);
  const mainMarks = useMemo(
    () => subtreeIsolationMarksFactory.hiding(decomposition.isolatedIds),
    [decomposition],
  );

  const normalBlend = constants.CAPTION_BLEND_NORMAL;
  const segmentBlendMode = segmentLayer.blendMode;
  const wrapperStyle = useMemo<CSSProperties>(
    () => {
      const blended = blendStyleOf(segmentBlendMode, normalBlend);
      if (!supportsSegmentRotation) {
        return { ...wrapperBaseStyles, ...segmentAlignmentVars, ...blended };
      }
      return {
        ...wrapperBaseStyles,
        ...segmentAlignmentVars,
        ['--tscaps-rotation' as string]: '0deg',
        transform: segmentRotationDeg === 0 ? 'none' : `rotate(${segmentRotationDeg}deg)`,
        transformOrigin: 'center',
        ...blended,
      };
    },
    [supportsSegmentRotation, wrapperBaseStyles, segmentAlignmentVars, segmentRotationDeg, segmentBlendMode, normalBlend],
  );

  const isolatedCopies = useMemo<ReadonlyArray<IsolatedCopy>>(
    () => decomposition.isolatedGroups.filter((group) => group.layer.stacking === stacking).map((group) => ({
      key: [...group.keptIds].join(','),
      marks: subtreeIsolationMarksFactory.keeping(group.keptIds, decomposition.isolatedIds),
      // The copy's own layer decides its blend, whatever the segment's.
      wrapperStyle: { ...wrapperStyle, mixBlendMode: undefined, ...blendStyleOf(group.layer.blendMode, normalBlend) },
    })),
    [decomposition, wrapperStyle, stacking, normalBlend],
  );

  // An element painted at its own anchor takes its layer's blend on the
  // wrapper of its own subtree. Hands the shared object back when it
  // has none, so the memoized layers do not re-render for nothing.
  const positionedWrapperStyles = (elementId: string): CSSProperties => {
    const blend = blendStyleOf(elementLayerOf(elementId).blendMode, normalBlend);
    return Object.keys(blend).length > 0 ? { ...wrapperBaseStyles, ...blend } : wrapperBaseStyles;
  };
  const paintsHere = (elementId: string): boolean => elementLayerOf(elementId).stacking === stacking;

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
    // `rendersMain`: the main subtree can move to the other side's layer
    // when a word goes behind the actor, and the binding follows it.
  }, [manipulationController, segment.id, sheet.id, rendersMain]);

  return (
    <Fragment>
      {rendersMain && (
      <div className="subtitle-overlay-anchor" style={anchorStyle}>
        <div
          ref={wrapperRef}
          className={`subtitle-overlay-wrapper ${sheetOverlayArtifactsBuilder.scopeClassFor(sheet.id)}`}
          style={wrapperStyle}
          aria-live="polite"
        >
          <IsolationMarksProvider value={mainMarks}>
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
          </IsolationMarksProvider>
        </div>
      </div>
      )}
      {/* Same anchor, classes and widths as the original, so each copy
          lays out exactly over it. No interaction ref: the segment's
          geometry is read off the original. */}
      {isolatedCopies.map((copy) => (
        <IsolatedSegmentCopy
          key={copy.key}
          segmentId={segment.id}
          anchorStyle={anchorStyle}
          wrapperClassName={`subtitle-overlay-wrapper ${sheetOverlayArtifactsBuilder.scopeClassFor(sheet.id)}`}
          wrapperStyle={copy.wrapperStyle}
        >
          <IsolationMarksProvider value={copy.marks}>
            <SegmentView
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
              extraSegmentClasses={behindActorStateClasses}
            />
          </IsolationMarksProvider>
        </IsolatedSegmentCopy>
      ))}
      {positionedWords.filter((entry) => paintsHere(entry.word.id)).map((entry) => (
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
          wrapperBaseStyles={positionedWrapperStyles(entry.word.id)}
          inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
        />
      ))}
      {rendersMain && draggedWordPreviewEntry && (
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
      {positionedDecorations.filter((entry) => paintsHere(entry.decorationId)).map((entry) => (
        <PositionedDecorationLayer
          key={entry.decorationId}
          sheet={sheet}
          segment={segment}
          indexInSection={segIdx}
          line={entry.line}
          word={entry.word}
          segmentAlignment={segmentAlignment}
          wrapperBaseStyles={positionedWrapperStyles(entry.decorationId)}
        />
      ))}
      {rendersMain && draggedDecorationPreviewEntry && (
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

/**
 * The blend a subtree's wrapper carries for the layer it paints in. The
 * export composites a blended layer onto everything beneath it; here
 * every subtree is DOM in one stacking context with the video and the
 * actor cutout, so the same blend written on the subtree's wrapper
 * reaches the same pixels. Nothing for a plain layer, so a wrapper that
 * blends nothing carries no property at all.
 */
function blendStyleOf(blendMode: CaptionBlendMode, normal: CaptionBlendMode): CSSProperties {
  return blendMode === normal ? {} : { mixBlendMode: blendMode as CSSProperties['mixBlendMode'] };
}

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

