import { memo, useMemo, type CSSProperties } from 'react';
import type { AlignmentConfig, Line, Segment, Word, WordSplitter } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import { WordView } from '@ui/pages/editor/features/overlay/components/words/WordView';
import { VideoFrameLayer } from '@ui/pages/editor/features/overlay/components/video-frame/VideoFrameLayer';
import { useBoundLine, useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useWordDragPreview } from '@ui/pages/editor/features/overlay/hooks/useWordDragPreview';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useSheetOverlayArtifactsBuilder } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';
import { useWordStyleBaselineResolver } from '@ui/pages/editor/contexts/WordStyleBaselineContext';

const alignmentCssBuilder = new AlignmentCssBuilder();

interface PositionedWordLayerProps {
  sheet: Sheet;
  segment: Segment;
  /** Zero-based position of `segment` inside its owning section, published as `--segment-index` on the bound segment node. */
  indexInSection: number;
  line: Line;
  word: Word;
  /** Zero-based position of `word` inside `line.words`, published as `--word-index` on the bound word node. */
  indexInLine: number;
  segmentAlignment: AlignmentConfig;
  letterSplitter: WordSplitter | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  /** Sheet- and segment-level inline styles the wrapper inherits — minus its alignment-dependent vars. */
  wrapperBaseStyles: CSSProperties;
  /** Decoration ids whose inline `<span>` should be omitted — the glyph either paints out of flow at its own anchor, or the emoji effect is disabled on the host sheet. */
  inlineSuppressedDecorationIds: ReadonlySet<string>;
}

const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };
const EMPTY_VARS: Readonly<Record<string, string>> = {};
const EMPTY_DECORATION_STYLE: Readonly<Record<string, string>> = {};

/** Sibling anchor for a word with a per-word alignment override. Mirrors the main `<anchor><wrapper><segment><line><word>` chain so template rules and animations apply identically. */
export const PositionedWordLayer = memo(function PositionedWordLayer({
  sheet,
  segment,
  indexInSection,
  line,
  word,
  indexInLine,
  segmentAlignment,
  letterSplitter,
  wordStyleOverrides,
  wrapperBaseStyles,
  inlineSuppressedDecorationIds,
}: PositionedWordLayerProps) {
  const segRef = useBoundSegment(segment, indexInSection);
  const lineRef = useBoundLine(line, segment);
  const baselineResolver = useWordStyleBaselineResolver();
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();

  const savedAlignment = useMemo<AlignmentConfig>(
    () => baselineResolver.wordEffectiveAlignment(segmentAlignment, wordStyleOverrides, word.id),
    [baselineResolver, segmentAlignment, wordStyleOverrides, word.id],
  );
  const dragPreview = useWordDragPreview(word.id);
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

  const wordInlineStyle = useMemo(
    () => wordStyleOverrides.buildInlineStyles(word.id),
    [wordStyleOverrides, word.id],
  );

  const decorationInlineStyle = useMemo(
    () => word.decoration ? wordStyleOverrides.buildInlineStyles(word.decoration.id) : EMPTY_DECORATION_STYLE,
    [wordStyleOverrides, word.decoration],
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
        <div ref={segRef} style={PAUSED_ANIMATION_STYLE}>
          {liveVideoFrame && <VideoFrameLayer />}
          <div ref={lineRef} style={PAUSED_ANIMATION_STYLE}>
            <WordView
              word={word}
              segment={segment}
              indexInLine={indexInLine}
              letterSplitter={letterSplitter}
              inlineStyle={wordInlineStyle}
              decorationInlineStyle={decorationInlineStyle}
              suppressInlineDecoration={suppressInlineDecoration}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
