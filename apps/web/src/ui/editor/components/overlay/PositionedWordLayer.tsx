import { memo, useMemo, type CSSProperties } from 'react';
import type { AlignmentConfig, Line, Segment, Word, WordSplitter } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import { WordView } from '@ui/editor/components/overlay/WordView';
import { VideoFrameLayer } from '@ui/editor/components/overlay/VideoFrameLayer';
import { useBoundLine, useBoundSegment } from '@ui/editor/components/overlay/useOverlayBinding';
import { useWordDragPreview } from '@ui/editor/components/overlay/useWordDragPreview';
import { AlignmentCssBuilder } from '@presentation/editor/services/AlignmentCssBuilder';
import { useSheetOverlayArtifactsBuilder } from '@ui/editor/contexts/SheetOverlayArtifactsContext';
import { useWordStyleBaselineResolver } from '@ui/editor/contexts/WordStyleBaselineContext';

const alignmentCssBuilder = new AlignmentCssBuilder();

interface PositionedWordLayerProps {
  sheet: Sheet;
  segment: Segment;
  line: Line;
  word: Word;
  segmentAlignment: AlignmentConfig;
  letterSplitter: WordSplitter | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  /** Sheet- and segment-level inline styles (typography, color, segment overrides) that the wrapper inherits — same set the main segment wrapper carries, minus its alignment-dependent vars. */
  wrapperBaseStyles: CSSProperties;
}

// className left to the overlay controller — see SegmentView/LineView.
const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };
const EMPTY_VARS: Readonly<Record<string, string>> = {};

/** Sibling anchor for a word with a per-word alignment override. Mirrors the main `<anchor><wrapper><segment><line><word>` chain so template rules and animations apply identically; the in-flow slot is rendered as a `visibility: hidden` placeholder by `WordView`. */
export const PositionedWordLayer = memo(function PositionedWordLayer({
  sheet,
  segment,
  line,
  word,
  segmentAlignment,
  letterSplitter,
  wordStyleOverrides,
  wrapperBaseStyles,
}: PositionedWordLayerProps) {
  const segRef = useBoundSegment(segment);
  const lineRef = useBoundLine(line);
  const baselineResolver = useWordStyleBaselineResolver();
  const sheetOverlayArtifactsBuilder = useSheetOverlayArtifactsBuilder();

  const savedAlignment = useMemo<AlignmentConfig>(
    () => baselineResolver.wordEffectiveAlignment(segmentAlignment, wordStyleOverrides, word.id),
    [baselineResolver, segmentAlignment, wordStyleOverrides, word.id],
  );
  // While the user is actively dragging THIS word, follow the cursor
  // through the controller's drag state instead of the (stale) saved
  // override. On commit, the saved value catches up and `dragPreview`
  // returns null, snapping cleanly to the committed position.
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

  // When the template paints a video-backed background through
  // `.tscaps-video-frame-layer`, the mini-segment that hosts a
  // positioned word needs its own copy so the word's backdrop
  // (frosted glass, etc.) keeps rendering at its new location.
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
              segmentId={segment.id}
              letterSplitter={letterSplitter}
              inlineStyle={wordInlineStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
