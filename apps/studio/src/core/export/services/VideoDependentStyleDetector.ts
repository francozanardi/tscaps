import type { Document } from '@tscaps/engine';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';

export interface VideoDependentStyleRequest {
  readonly document: Document;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly elementStyles: ElementStyles;
}

/**
 * Says whether a project's captions look the way they do because of the
 * video under them: a template that paints the video into the caption (a
 * blur, a frame layer), or an element blended with it. Rendered without
 * the video, those captions look different.
 */
export class VideoDependentStyleDetector {

  dependsOnVideo(request: VideoDependentStyleRequest): boolean {
    return this.usesTemplateReadingVideo(request) || this.blendsAnyElement(request.elementStyles);
  }

  private usesTemplateReadingVideo({ document, sheets }: VideoDependentStyleRequest): boolean {
    const usedSheetIds = new Set(document.sections.map((section) => section.kind));
    return sheets.some((sheet) => usedSheetIds.has(sheet.id) && sheet.template.rendering.videoFrame.required);
  }

  private blendsAnyElement(elementStyles: ElementStyles): boolean {
    return [...elementStyles.elementIds()].some((elementId) => elementStyles.blendOf(elementId) !== null);
  }
}
