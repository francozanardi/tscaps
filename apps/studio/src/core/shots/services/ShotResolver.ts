import type { Document, Word } from '@tscaps/engine';
import type { ResolvedShot, ShotWordPiece } from '@core/shots/domain/ResolvedShot';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * Reads a partition against a document: where each shot ends, what is
 * said inside it, and what still shows on it from the shots before.
 *
 * A word the shot cuts through is split where the boundary falls and
 * marked with an ellipsis, so the two halves are not read as two
 * unrelated words sitting in cards far apart.
 */
export class ShotResolver {
  private static readonly ELLIPSIS = '…';

  resolve(partition: ShotPartition, document: Document | null, videoDurationSec: number): ResolvedShot[] {
    const shots = partition.list();
    if (shots.length === 0) return [];
    const words = this.wordsInTimeOrder(document);
    return shots.map((shot, index) => {
      const endSec = shots[index + 1]?.startSec ?? videoDurationSec;
      return {
        id: shot.id,
        startSec: shot.startSec,
        endSec,
        pieces: this.piecesBetween(words, shot.startSec, endSec),
        layers: shot.layers,
        continuingLayers: partition.layersContinuingInto(shot.id),
        ...(shot.transition === undefined ? {} : { transition: shot.transition }),
      };
    });
  }

  private piecesBetween(words: ReadonlyArray<Word>, startSec: number, endSec: number): ShotWordPiece[] {
    const pieces: ShotWordPiece[] = [];
    for (const word of words) {
      if (word.time.start >= endSec) continue;
      // Where a word starts is enough to hold it: one with no duration
      // overlaps nothing, and would otherwise fall out of every shot.
      if (word.time.end <= startSec && word.time.start < startSec) continue;
      const text = this.pieceOf(word, startSec, endSec);
      if (text !== '') pieces.push({ wordId: word.id, text, startSec: word.time.start, endSec: word.time.end });
    }
    return pieces;
  }

  private pieceOf(word: Word, startSec: number, endSec: number): string {
    const opensBefore = word.time.start < startSec;
    const closesAfter = word.time.end > endSec;
    if (!opensBefore && !closesAfter) return word.text;
    const characters = [...word.text];
    // A piece with no letters in it is not a piece: the word goes
    // whole to the side that holds letters, and this one shows none.
    const spoken = this.charactersBefore(word, opensBefore ? startSec : endSec, characters.length);
    if (opensBefore) {
      if (spoken <= 0) return word.text;
      if (spoken >= characters.length) return '';
      return `${ShotResolver.ELLIPSIS}${characters.slice(spoken).join('')}`;
    }
    if (spoken >= characters.length) return word.text;
    if (spoken <= 0) return '';
    return `${characters.slice(0, spoken).join('')}${ShotResolver.ELLIPSIS}`;
  }

  private charactersBefore(word: Word, sec: number, length: number): number {
    const span = word.time.end - word.time.start;
    if (span <= 0) return length;
    return Math.round(((sec - word.time.start) / span) * length);
  }

  private wordsInTimeOrder(document: Document | null): Word[] {
    if (!document) return [];
    return document.sections
      .flatMap((section) => section.segments.flatMap((segment) => segment.getWords()))
      .sort((a, b) => a.time.start - b.time.start);
  }
}
