import type { Document, Segment } from '@tscaps/engine';
import type { CaptionRefKind } from '@core/editor-operations/services/CaptionRefResolver';

/** The scene a caption element is part of, and the sheet that scene is painted with. */
export interface CaptionScene {
  readonly segment: Segment;
  readonly sheetId: string;
}

/**
 * Finds the scene a caption element belongs to: a segment is its own
 * scene, and a line, a word or an emoji belongs to the segment holding
 * it. The sheet is read off the section the scene sits in, whose kind
 * is the id of the sheet it is painted with.
 */
export class CaptionSceneLocator {
  /** The scene holding the element of `kind` whose id is `id`, or null when `document` holds no such element. */
  sceneOf(document: Document, kind: CaptionRefKind, id: string): CaptionScene | null {
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (this.holds(segment, kind, id)) return { segment, sheetId: section.kind };
      }
    }
    return null;
  }

  private holds(segment: Segment, kind: CaptionRefKind, id: string): boolean {
    switch (kind) {
      case 'segment':
        return segment.id === id;
      case 'line':
        return segment.lines.some((line) => line.id === id);
      case 'word':
        return segment.getWords().some((word) => word.id === id);
      case 'decoration':
        return segment.getWords().some((word) => word.decoration?.id === id);
    }
  }
}
