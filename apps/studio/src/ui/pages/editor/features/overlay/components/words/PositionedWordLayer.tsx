import { memo, useMemo, useRef, type CSSProperties } from 'react';
import type { AlignmentConfig, Line, Segment, Word, WordSplitter } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { WordView } from '@ui/pages/editor/features/overlay/components/words/WordView';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';
import { VideoFrameLayer } from '@ui/pages/editor/features/overlay/components/video-frame/VideoFrameLayer';
import { useBoundLine, useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useWordDragPreview } from '@ui/pages/editor/features/overlay/hooks/useWordDragPreview';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useSheetOverlayArtifactsBuilder } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';
import { useElementAlignmentResolver } from '@ui/pages/editor/contexts/ElementAlignmentContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';


interface PositionedWordLayerProps {
  sheet: Sheet;
  segment: Segment;
  /** Zero-based position of `segment` among its sheet's segments, across all of its sections; published as `--segment-index` on the bound segment node. */
  segmentIndex: number;
  line: Line;
  word: Word;
  /** Zero-based position of `word` inside `line.words`, published as `--word-index` on the bound word node. */
  indexInLine: number;
  segmentAlignment: AlignmentConfig;
  letterSplitter: WordSplitter | null;
  /** Resolved `font-family` the word declares because its script differs from its surroundings, or `undefined` to inherit the cascade. */
  fontFamily: string | undefined;
  /** Sheet- and segment-level inline styles the wrapper inherits — minus its alignment-dependent vars. */
  wrapperBaseStyles: CSSProperties;
  /** Decoration ids whose inline `<span>` should be omitted — the glyph either paints out of flow at its own anchor, or the emoji effect is disabled on the host sheet. */
  inlineSuppressedDecorationIds: ReadonlySet<string>;
}

const EMPTY_VARS: Readonly<Record<string, string>> = {};

/** Sibling anchor for a word with a per-word alignment override. Mirrors the main `<anchor><wrapper><segment><line><word>` chain so template rules and animations apply identically. */
export const PositionedWordLayer = memo(function PositionedWordLayer({
  sheet,
  segment,
  segmentIndex,
  line,
  word,
  indexInLine,
  segmentAlignment,
  letterSplitter,
  fontFamily,
  wrapperBaseStyles,
  inlineSuppressedDecorationIds,
}: PositionedWordLayerProps) {
  const segRef = useRef<HTMLDivElement>(null);
  useBoundSegment(segRef, segment, segmentIndex);
  const lineRef = useBoundLine(line, segment);
  const baselineResolver = useElementAlignmentResolver();
  const { elementStyles } = useEditorState();
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();
  const { wordFragmenter } = useRendering();

  const savedAlignment = useMemo<AlignmentConfig>(
    () => baselineResolver.wordEffectiveAlignment(segmentAlignment, elementStyles, word.id),
    [baselineResolver, segmentAlignment, elementStyles, word.id],
  );
  const dragPreview = useWordDragPreview(word.id);
  const effectiveAlignment = dragPreview ?? savedAlignment;

  const { horizontalPlacementResolver } = useRendering();
  const alignmentCssBuilder = useMemo(
    () => new AlignmentCssBuilder(horizontalPlacementResolver),
    [horizontalPlacementResolver],
  );

  const anchorStyle = useMemo<CSSProperties>(
    () => alignmentCssBuilder.buildAnchorStyle(effectiveAlignment, sheet.textDirection),
    [alignmentCssBuilder, effectiveAlignment, sheet.textDirection],
  );

  const videoFrameRequired = sheet.template.rendering.videoFrame.required;
  const alignmentVars = useMemo<Readonly<Record<string, string>>>(
    () => ({
      ...alignmentCssBuilder.buildAnchorVars(effectiveAlignment),
      ...(videoFrameRequired ? alignmentCssBuilder.buildSubtitleRegionVars(effectiveAlignment, sheet.textDirection) : EMPTY_VARS),
    }),
    [alignmentCssBuilder, videoFrameRequired, effectiveAlignment, sheet.textDirection],
  );

  const wrapperStyle = useMemo<CSSProperties>(
    () => ({ ...wrapperBaseStyles, ...alignmentVars }),
    [wrapperBaseStyles, alignmentVars],
  );

  const suppressInlineDecoration = word.decoration !== null && inlineSuppressedDecorationIds.has(word.decoration.id);

  const liveVideoFrame = videoFrameRequired && sheet.template.rendering.videoFrame.previewMode === 'live';

  return (
    <div className="subtitle-overlay-anchor" style={anchorStyle}>
      <div
        className={`subtitle-overlay-wrapper subtitle-overlay-positioned-word-host ${sheetOverlayArtifactsBuilder.scopeClassFor(sheet.id)}`}
        style={wrapperStyle}
        data-tscaps-segment-id={segment.id}
      >
        <div ref={segRef} {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: segment.id }}>
          {liveVideoFrame && <VideoFrameLayer />}
          <div ref={lineRef} {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: line.id }}>
            {wordFragmenter.fragment([word.displayText], sheet.textDirection).map((fragment, index, all) => (
              <WordView
                key={index}
                word={word}
                fragment={fragment}
                closeGapAfter={all[index + 1]?.joinedToPrevious ?? false}
                segment={segment}
                indexInLine={indexInLine}
                letterSplitter={letterSplitter}
                fontFamily={fontFamily}
                suppressInlineDecoration={suppressInlineDecoration || !fragment.carriesWordTail}
                carriesTrail={fragment.carriesWordTail}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
