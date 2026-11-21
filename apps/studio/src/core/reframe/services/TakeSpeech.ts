import type { Word } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SpokenPhrase, SpokenWordStart } from '@core/reframe/domain/SpokenPhrase';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

// A silence this long between two words ends a phrase.
const PAUSE_SEC = 0.7;
const SENTENCE_END = /[.?!…]["')\]]?$/;

/**
 * What is said in a stretch of the video, read from the captions in the
 * video's own language whatever track is shown: as phrases, each with
 * the moment it starts, and as the word that starts nearest a moment.
 */
export class TakeSpeech {
  constructor(
    private readonly store: EditorStore,
    private readonly originalCaptions: OriginalCaptionTrackReader,
  ) {}

  /**
   * The phrases said between `fromSec` and `toSec` (a word belongs where
   * its middle falls), in time order: a phrase ends with its sentence,
   * at a pause, or where the voice changes. Empty where nothing is said
   * there.
   */
  phrases(fromSec: number, toSec: number): SpokenPhrase[] {
    const phrases: SpokenPhrase[] = [];
    let previous: Word | null = null;
    for (const word of this.words(fromSec, toSec)) {
      const last = phrases[phrases.length - 1];
      if (last === undefined || previous === null || this.endsPhrase(previous, word)) {
        phrases.push({ speaker: word.speakerId, startSec: word.time.start, text: word.text });
      } else {
        phrases[phrases.length - 1] = { ...last, text: `${last.text} ${word.text}` };
      }
      previous = word;
    }
    return phrases;
  }

  /** The word said between `fromSec` and `toSec` that starts nearest `sec`; null where nothing is said there. */
  wordNearest(sec: number, fromSec: number, toSec: number): SpokenWordStart | null {
    let nearest: Word | null = null;
    for (const word of this.words(fromSec, toSec)) {
      if (word.time.start < fromSec || word.time.start > toSec) continue;
      if (nearest === null || Math.abs(word.time.start - sec) < Math.abs(nearest.time.start - sec)) nearest = word;
    }
    return nearest === null ? null : { wordId: nearest.id, startSec: nearest.time.start };
  }

  private words(fromSec: number, toSec: number): Word[] {
    const document = this.originalCaptions.read(this.store.snapshot()).document;
    if (document === null) return [];
    return document.getWords()
      .filter((word) => this.middleOf(word) >= fromSec && this.middleOf(word) < toSec)
      .sort((first, second) => first.time.start - second.time.start);
  }

  private endsPhrase(previous: Word, word: Word): boolean {
    return previous.speakerId !== word.speakerId
      || SENTENCE_END.test(previous.text.trim())
      || word.time.start - previous.time.end >= PAUSE_SEC;
  }

  private middleOf(word: Word): number {
    return (word.time.start + word.time.end) / 2;
  }
}
