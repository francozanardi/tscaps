import { memo, useMemo, type CSSProperties } from 'react';
import type { AlignmentConfig, Line, Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import { WordDecorationSpan } from '@ui/pages/editor/features/overlay/components/words/WordDecorationSpan';
import { VideoFrameLayer } from '@ui/pages/editor/features/overlay/components/video-frame/VideoFrameLayer';
import { useBoundLine, useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useWordDragPreview } from '@ui/pages/editor/features/overlay/hooks/useWordDragPreview';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useSheetOverlayArtifactsBuilder } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';

const alignmentCssBuilder = new AlignmentCssBuilder();

interface PositionedDecorationLayerProps {
  sheet: Sheet;
  segment: Segment;
  /** Zero-based position of `segment` inside its owning section, published as `--segment-index` on the bound segment node. */
  indexInSection: number;
  line: Line;
  /** Word that owns the decoration glyph. */
  word: Word;
  segmentAlignment: AlignmentConfig;
  wordStyleOverrides: WordStyleOverrideRegistry;
  /** Sheet- and segment-level inline styles the wrapper inherits — minus its alignment-dependent vars. */
  wrapperBaseStyles: CSSProperties;
}

const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };
const EMPTY_VARS: Readonly<Record<string, string>> = {};

/** Sibling anchor for a decoration glyph painted out of flow. */
export const PositionedDecorationLayer = memo(function PositionedDecorationLayer({
  sheet,
  segment,
  indexInSection,
  line,
  word,
  segmentAlignment,
  wordStyleOverrides,
  wrapperBaseStyles,
}: PositionedDecorationLayerProps) {
  const segRef = useBoundSegment(segment, indexInSection);
  const lineRef = useBoundLine(line, segment);
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();

  const decoration = word.decoration!;

  const savedAlignment = useMemo<AlignmentConfig>(
    () => ({
      ...segmentAlignment,
      ...(wordStyleOverrides.buildAlignmentOverride(decoration.id) ?? {}),
    }),
    [segmentAlignment, wordStyleOverrides, decoration.id],
  );
  const dragPreview = useWordDragPreview(decoration.id);
  const effectiveAlignment = dragPreview ?? savedAlignment;

  const anchorStyle = useMemo<CSSProperties>(
    () => alignmentCssBuilder.buildAnchorStyle(effectiveAlignment),
    [effectiveAlignment],
  );

  const videoFrameRequired = sheet.template.rendering.videoFrame.required;
  const subtitleRegionVars = useMemo<Readonly<Record<string, string>>>(
    () => videoFrameRequired ? alignmentCssBuilder.buildSubtitleRegionVars(effectiveAlignment) : EMPTY_VARS,
    [videoFrameRequired, effectiveAlignment],
  );

  const wrapperStyle = useMemo<CSSProperties>(
    () => ({ ...wrapperBaseStyles, ...subtitleRegionVars }),
    [wrapperBaseStyles, subtitleRegionVars],
  );

  const decorationInlineStyle = useMemo(
    () => wordStyleOverrides.buildInlineStyles(decoration.id),
    [wordStyleOverrides, decoration.id],
  );

  const liveVideoFrame = videoFrameRequired && sheet.template.rendering.videoFrame.previewMode === 'live';

  return (
    <div className="subtitle-overlay-anchor" style={anchorStyle}>
      <div
        className={`subtitle-overlay-wrapper subtitle-overlay-positioned-word-host ${sheetOverlayArtifactsBuilder.scopeClassFor(sheet.id)}`}
        style={wrapperStyle}
        data-tscaps-segment-id={segment.id}
      >
        <div ref={segRef} style={PAUSED_ANIMATION_STYLE}>
          {liveVideoFrame && <VideoFrameLayer />}
          <div ref={lineRef} style={PAUSED_ANIMATION_STYLE}>
            <WordDecorationSpan
              decoration={decoration}
              segment={segment}
              word={word}
              inlineStyle={decorationInlineStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
