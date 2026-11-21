import type { Document } from '@tscaps/engine';
import type { CaptionRefKind } from '@core/editor-operations/services/CaptionRefResolver';

/** A caption node one element is painted inside. */
export interface CaptionAncestor {
  readonly kind: Extract<CaptionRefKind, 'segment' | 'line' | 'word'>;
  readonly id: string;
}

/**
 * Finds the caption nodes an element is painted inside, nearest first: a
 * line sits in its segment, a word in its line and segment, and an emoji
 * in the word it rides, that word's line and its segment.
 */
export class CaptionAncestorLocator {
  /** The nodes around the element of `kind` whose id is `id`, nearest first; empty for a segment and for an element `document` does not hold. */
  ancestorsOf(document: Document, kind: CaptionRefKind, id: string): ReadonlyArray<CaptionAncestor> {
    for (const segment of document.getSegments()) {
      if (kind === 'segment' && segment.id === id) return [];
      for (const line of segment.lines) {
        const around: CaptionAncestor[] = [{ kind: 'line', id: line.id }, { kind: 'segment', id: segment.id }];
        if (kind === 'line' && line.id === id) return around.slice(1);
        for (const word of line.words) {
          if (kind === 'word' && word.id === id) return around;
          if (kind === 'decoration' && word.decoration?.id === id) return [{ kind: 'word', id: word.id }, ...around];
        }
      }
    }
    return [];
  }
}
