import { memo, useMemo, useRef, type CSSProperties } from 'react';
import type { AlignmentConfig, Line, Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { WordDecorationSpan } from '@ui/pages/editor/features/overlay/components/words/WordDecorationSpan';
import { VideoFrameLayer } from '@ui/pages/editor/features/overlay/components/video-frame/VideoFrameLayer';
import { useBoundLine, useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useWordDragPreview } from '@ui/pages/editor/features/overlay/hooks/useWordDragPreview';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useSheetOverlayArtifactsBuilder } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';


interface PositionedDecorationLayerProps {
  sheet: Sheet;
  segment: Segment;
  /** Zero-based position of `segment` inside its owning section, published as `--segment-index` on the bound segment node. */
  indexInSection: number;
  line: Line;
  /** Word that owns the decoration glyph. */
  word: Word;
  segmentAlignment: AlignmentConfig;
  /** Sheet- and segment-level inline styles the wrapper inherits — minus its alignment-dependent vars. */
  wrapperBaseStyles: CSSProperties;
}

const EMPTY_VARS: Readonly<Record<string, string>> = {};

/** Sibling anchor for a decoration glyph painted out of flow. */
export const PositionedDecorationLayer = memo(function PositionedDecorationLayer({
  sheet,
  segment,
  indexInSection,
  line,
  word,
  segmentAlignment,
  wrapperBaseStyles,
}: PositionedDecorationLayerProps) {
  const segRef = useRef<HTMLDivElement>(null);
  useBoundSegment(segRef, segment, indexInSection);
  const lineRef = useBoundLine(line, segment);
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();
  const { elementStyles } = useEditorState();

  const decoration = word.decoration!;

  const savedAlignment = useMemo<AlignmentConfig>(
    () => ({
      ...segmentAlignment,
      ...(elementStyles.placementOf(decoration.id) ?? {}),
    }),
    [segmentAlignment, elementStyles, decoration.id],
  );
  const dragPreview = useWordDragPreview(decoration.id);
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
            <WordDecorationSpan
              decoration={decoration}
              segment={segment}
              word={word}
              insideWord={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
