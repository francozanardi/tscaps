import type { Segment } from '@tscaps/engine';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import type { BehindActorSegmentClassResolver } from '@presentation/editor/services/BehindActorSegmentClassResolver';
import type { CaptionPaintState, RestingCaption, RestingCaptionSource } from '@presentation/editor/services/RestingCaptionProbe';
import type { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';

/**
 * Finds a word's caption among the captions a sheet owns in the document
 * as painted, and dresses it the way the overlay paints it: the sheet's
 * scope class, the variables its typography and controls declare, the
 * colour its rotation hands that one caption, the class the
 * text-behind-actor effect puts on it, the video frame layer the
 * preview paints inside it, and the words given a placement, which the
 * overlay paints alone.
 *
 * Captions are numbered by the overlay's own count, so the position a
 * caption publishes, and the rotation colour that follows from it, is
 * the one on screen even after a cut removed a caption before it.
 */
export class OverlayRestingCaptionSource implements RestingCaptionSource {
  constructor(
    private readonly artifacts: SheetOverlayArtifactsBuilder,
    private readonly colorRotation: SegmentColorRotation,
    private readonly behindActorClasses: BehindActorSegmentClassResolver,
  ) {}

  captionOf(state: CaptionPaintState, sheet: Sheet, wordId: string): RestingCaption | null {
    const segment = this.segmentHolding(state, sheet, wordId);
    if (!segment) return null;
    const segmentIndex = this.artifacts.buildSegmentPositions(state.document, [sheet]).positionOf(sheet.id, segment.id);
    return {
      segment,
      segmentIndex,
      scopeClass: this.artifacts.scopeClassFor(sheet.id),
      wrapperStyles: {
        ...this.artifacts.buildWrapperVars(sheet),
        ...this.colorRotation.resolveOverrides(sheet, segment.id, segmentIndex),
      },
      textDirection: sheet.textDirection,
      splitWordsIntoLetters: sheet.template.rendering.splitWordsIntoLetters,
      includeVideoFrameLayer: this.paintsVideoFrameLayer(sheet),
      segmentStateClasses: this.behindActorClasses.classesFor(
        segment,
        state.behindActorSegmentIds.has(segment.id),
        state.behindActorElementIds,
      ),
      positionedWordIds: this.positionedWords(segment, state.elementStyles),
    };
  }

  private segmentHolding(state: CaptionPaintState, sheet: Sheet, wordId: string): Segment | null {
    for (const section of state.document.sections) {
      if (section.kind !== sheet.id) continue;
      const segment = section.segments.find((candidate) => this.holdsWord(candidate, wordId));
      if (segment) return segment;
    }
    return null;
  }

  private holdsWord(segment: Segment, wordId: string): boolean {
    return segment.lines.some((line) => line.words.some((word) => word.id === wordId));
  }

  // The preview paints the frame layer only for a template asking for it
  // live; one that omits it in the preview has it in the export alone.
  private paintsVideoFrameLayer(sheet: Sheet): boolean {
    const videoFrame = sheet.template.rendering.videoFrame;
    return videoFrame.required && videoFrame.previewMode === 'live';
  }

  // The same question the overlay asks the store: a word with a placement
  // is painted at its own anchor and leaves a gap in its line.
  private positionedWords(segment: Segment, elementStyles: ElementStyles): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const line of segment.lines) {
      for (const word of line.words) {
        if (elementStyles.placementOf(word.id)) ids.add(word.id);
      }
    }
    return ids;
  }
}
