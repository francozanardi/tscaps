import type { Document } from '@tscaps/engine';
import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewNoteRefReading } from '@core/review-notes/domain/ReviewNoteRefReading';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/** What a ref can be looked up in: the captions on screen and the video's shots. */
export interface ReviewNoteRefScope {
  readonly document: Document | null;
  readonly shots: ShotPartition;
}

/**
 * Looks a note's ref up in the project as it is now, and answers what it
 * shows. A word keeps its id for good; a segment keeps it only while its
 * words stay the same, and a line's changes whenever the captions
 * reflow, so a ref read now can be gone.
 */
export class ReviewNoteRefReader {
  read(ref: ReviewNoteRef, scope: ReviewNoteRefScope): ReviewNoteRefReading {
    switch (ref.kind) {
      case 'segment':
      case 'line':
      case 'word':
      case 'decoration':
        return this.captionWordsOf(ref, scope.document);
      case 'layer':
        return this.found(scope.shots.list().some((shot) => shot.layers.some((layer) => layer.id === ref.id)), null);
      case 'shot':
        return this.found(scope.shots.list().some((shot) => shot.id === ref.id), null);
    }
  }

  private captionWordsOf(ref: ReviewNoteRef, document: Document | null): ReviewNoteRefReading {
    if (document === null) return { status: 'gone' };
    switch (ref.kind) {
      case 'segment':
        return this.textOf(document.getSegments().find((segment) => segment.id === ref.id)?.getText());
      case 'line':
        return this.textOf(document.getLines().find((line) => line.id === ref.id)?.getText());
      case 'word':
        return this.textOf(document.getWords().find((word) => word.id === ref.id)?.text);
      default:
        return this.textOf(document.getWords().find((word) => word.decoration?.id === ref.id)?.decoration?.glyph);
    }
  }

  private textOf(text: string | undefined): ReviewNoteRefReading {
    return text === undefined ? { status: 'gone' } : { status: 'found', words: text };
  }

  private found(exists: boolean, words: string | null): ReviewNoteRefReading {
    return exists ? { status: 'found', words } : { status: 'gone' };
  }
}
