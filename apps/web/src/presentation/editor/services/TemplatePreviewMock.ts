import { Word, Line, Segment, Section, Document, TimeFragment, StructureTagger } from '@tscaps/engine';

export interface PreviewFrame {
  readonly segment: Segment;
  readonly line: Line;
  readonly word: Word;
}

/**
 * Synthetic document fragments every TemplateCard preview drives. The
 * timeline is fixed: three short words played back to back, so the
 * preview is deterministic regardless of the template. The single-word
 * frame is used by the resting (non-hover) card to render the template
 * name as one word that is both the first and the last in its line.
 * Build once and share — the instance carries no per-template state.
 */
export class TemplatePreviewMock {
  private static readonly WORDS: ReadonlyArray<string> = ['This', 'is', 'tscaps'];
  private static readonly SINGLE_WORD_TEXT: string = 'tscaps';

  readonly wordDuration: number = 0.5;
  readonly totalDuration: number;
  readonly segment: Segment;
  readonly line: Line;
  readonly singleWordFrame: PreviewFrame;

  constructor() {
    const multiWordDocument = this.buildMultiWordDocument();
    this.segment = multiWordDocument.sections[0]!.segments[0]!;
    this.line = this.segment.lines[0]!;
    this.singleWordFrame = this.buildSingleWordFrame();
    this.totalDuration = TemplatePreviewMock.WORDS.length * this.wordDuration;
  }

  private buildMultiWordDocument(): Document {
    const words = TemplatePreviewMock.WORDS.map((text, index) => this.buildWord(text, index));
    return this.tagDocument(words);
  }

  private buildSingleWordFrame(): PreviewFrame {
    const word = this.buildWord(TemplatePreviewMock.SINGLE_WORD_TEXT, 0);
    const tagged = this.tagDocument([word]);
    const segment = tagged.sections[0]!.segments[0]!;
    const line = segment.lines[0]!;
    return { segment, line, word: line.words[0]! };
  }

  private buildWord(text: string, index: number): Word {
    return new Word({
      text,
      time: new TimeFragment(index * this.wordDuration, (index + 1) * this.wordDuration),
    });
  }

  private tagDocument(words: Word[]): Document {
    const line = new Line({ words });
    const segment = new Segment({ lines: [line] });
    const section = new Section({ segments: [segment], kind: 'main' });
    const document = new Document({ sections: [section] });
    return new StructureTagger().tag(document);
  }
}
