import type { Document, DocumentEditor } from '@tscaps/engine';

/**
 * Splits and joins scenes of a document by word, as the transcript's
 * Enter and Backspace do, without touching any word's text or time. Pure:
 * each method answers the edited document, or null when the edit makes no
 * sense there.
 */
export class CaptionStructureEditor {
  constructor(private readonly editor: DocumentEditor) {}

  /** `document` with a new scene starting at word `wordId`; null when the word is missing or already starts its scene. */
  splitBefore(document: Document, wordId: string): Document | null {
    const at = this.editor.findWordById(document, wordId);
    if (at === null || (at.lineIdx === 0 && at.wordIdx === 0)) return null;
    if (at.wordIdx === 0) return this.editor.splitSegmentAfterLine(document, at.segIdx, at.lineIdx - 1);
    const lineSplit = this.editor.splitLineAfterWord(document, at.segIdx, at.lineIdx, at.wordIdx - 1);
    return this.editor.splitSegmentAfterLine(lineSplit, at.segIdx, at.lineIdx);
  }

  /**
   * `document` with the words from `firstWordId` to `lastWordId` as one
   * scene of their own: split before the first and after the last, and
   * every scene between joined, keeping each scene's lines. Null when
   * either word is missing or the last comes before the first.
   */
  withWordsAsOneScene(document: Document, firstWordId: string, lastWordId: string): Document | null {
    const words = document.getWords();
    const firstIndex = words.findIndex((word) => word.id === firstWordId);
    const lastIndex = words.findIndex((word) => word.id === lastWordId);
    if (firstIndex < 0 || lastIndex < firstIndex) return null;
    const startsAtFirst = this.splitBefore(document, firstWordId) ?? document;
    const wordAfter = words[lastIndex + 1];
    const endsAtLast = wordAfter === undefined ? startsAtFirst : this.splitBefore(startsAtFirst, wordAfter.id) ?? startsAtFirst;
    return this.joinUntilHolds(endsAtLast, firstWordId, lastWordId);
  }

  /** `document` with the scene holding `firstWordId` joined with the scenes after it until it holds `lastWordId`. */
  private joinUntilHolds(document: Document, firstWordId: string, lastWordId: string): Document {
    let edited = document;
    const sceneIndex = this.sceneIndexOf(edited, firstWordId);
    while (!edited.getSegments()[sceneIndex]!.getWords().some((word) => word.id === lastWordId)) {
      edited = this.editor.mergeSegmentWithNext(edited, sceneIndex);
    }
    return edited;
  }

  private sceneIndexOf(document: Document, wordId: string): number {
    return document.getSegments().findIndex((segment) => segment.getWords().some((word) => word.id === wordId));
  }

  /**
   * `document` with scene `segmentId` laid out in lines that start at the
   * words `lineStartIds`, in any order; every other word stays on the line
   * of the word before it. Empty puts the whole scene on one line. Null
   * when the scene is missing; ids that are not words of the scene, or name
   * its first word, are ignored.
   */
  withLineStarts(document: Document, segmentId: string, lineStartIds: ReadonlyArray<string>): Document | null {
    const segmentIndex = document.getSegments().findIndex((segment) => segment.id === segmentId);
    if (segmentIndex < 0) return null;
    const oneLine = this.mergeAllLines(document, segmentIndex);
    const words = oneLine.getSegments()[segmentIndex]!.getWords();
    const breakIndexes = lineStartIds
      .map((id) => words.findIndex((word) => word.id === id))
      .filter((index) => index > 0)
      .sort((first, second) => second - first);
    // From the last break to the first, so each split leaves the earlier words on line 0, where the next one reads them.
    return breakIndexes.reduce((edited, index) => this.editor.splitLineAfterWord(edited, segmentIndex, 0, index - 1), oneLine);
  }

  /** `document` with every line of the scene at `segmentIndex` merged into its first. */
  private mergeAllLines(document: Document, segmentIndex: number): Document {
    let edited = document;
    while (edited.getSegments()[segmentIndex]!.lines.length > 1) edited = this.editor.mergeLineWithNext(edited, segmentIndex, 0);
    return edited;
  }

  /** `document` with scene `segmentId` and the scene after it as one; null when it is missing or the last scene. */
  joinWithNext(document: Document, segmentId: string): Document | null {
    const segments = document.getSegments();
    const index = segments.findIndex((segment) => segment.id === segmentId);
    if (index < 0 || index === segments.length - 1) return null;
    return this.editor.mergeSegmentWithNext(document, index);
  }
}
