import { Word, Line, Segment, Section, Document, TimeFragment, StructureTagger, Decoration, Tag } from '@tscaps/engine';
import type { TemplateTile } from '@core/templates/domain/definition/TemplateTile';

/**
 * A caption a template preview draws: its segment, the moment a card at
 * rest is frozen at, and how long one pass of it runs for a card that
 * plays it.
 */
export interface PreviewCaption {
  readonly segment: Segment;
  readonly restTime: number;
  readonly duration: number;
}

/**
 * Synthetic captions every template preview drives. Words are said back
 * to back, half a second each, so a preview is deterministic whatever
 * the template.
 *
 * Three captions: the template's name as one word, for a card at rest;
 * three short words, for a card being hovered; and the caption a
 * template declares for its tile, which serves the card both ways. A
 * card at rest freezes mid-word, so a highlight that lasts as long as
 * the word is on, or near the end of the word in letter mode, so every
 * letter has appeared while the last one's cursor still shows.
 */
export class TemplatePreviewMock {
  private static readonly SAMPLE_WORDS: ReadonlyArray<string> = ['This', 'is', 'tscaps'];

  readonly wordDuration: number = 0.5;

  /** The template's name as one word that is both the first and the last of its line. */
  nameCaption(name: string, letterMode: boolean): PreviewCaption {
    const words = [this.buildWord(name, 0, [], null)];
    return this.caption([words], 0, letterMode);
  }

  /** Three short words in one line, for a card that plays its template. */
  sampleCaption(): PreviewCaption {
    const words = TemplatePreviewMock.SAMPLE_WORDS.map((text, index) => this.buildWord(text, index, [], null));
    return this.caption([words], words.length - 1, false);
  }

  /** The caption a template declares for its tile, resting on its `said` word, or on its last word when none is. */
  tileCaption(tile: TemplateTile, letterMode: boolean): PreviewCaption {
    const tileWords = tile.lines.flat();
    const saidIndex = tileWords.findIndex((tileWord) => tileWord.said);
    let index = 0;
    const lines = tile.lines.map((line) =>
      line.map((tileWord) => this.buildWord(tileWord.text, index++, tileWord.tags, tileWord.emoji)));
    return this.caption(lines, saidIndex < 0 ? tileWords.length - 1 : saidIndex, letterMode);
  }

  private caption(lines: ReadonlyArray<ReadonlyArray<Word>>, restIndex: number, letterMode: boolean): PreviewCaption {
    const segment = this.tagSegment(lines);
    const wordCount = lines.reduce((count, line) => count + line.length, 0);
    const restFraction = letterMode ? 0.99 : 0.5;
    return {
      segment,
      restTime: (restIndex + restFraction) * this.wordDuration,
      duration: wordCount * this.wordDuration,
    };
  }

  private buildWord(text: string, index: number, tags: readonly string[], emoji: string | null): Word {
    const word = new Word({
      text,
      time: new TimeFragment(index * this.wordDuration, (index + 1) * this.wordDuration),
      semanticTags: new Set(tags.map((tag) => Tag.of(tag))),
    });
    return emoji === null ? word : word.with({ decoration: new Decoration({ id: `${word.id}:d`, glyph: emoji }) });
  }

  private tagSegment(lines: ReadonlyArray<ReadonlyArray<Word>>): Segment {
    const segment = new Segment({ lines: lines.map((words) => new Line({ words: [...words] })) });
    const section = new Section({ segments: [segment], kind: 'main' });
    const document = new StructureTagger().tag(new Document({ sections: [section] }));
    return document.sections[0]!.segments[0]!;
  }
}
