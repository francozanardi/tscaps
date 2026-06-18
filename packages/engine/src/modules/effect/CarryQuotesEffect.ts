import type { Effect } from '@modules/effect/Effect';
import type { Document } from '@modules/document/Document';
import type { Section } from '@modules/document/Section';
import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

interface QuoteRun {
  readonly words: Word[];
  readonly openingChar: string;
  readonly closingChar: string;
}

interface WordEdit {
  prepend?: string;
  append?: string;
}

/**
 * Repeats the surrounding quotes on every segment of a long quotation
 * that the splitter has broken across boundaries. The opening quote
 * gets prepended to each segment that starts already inside the quote,
 * and the closing quote gets appended to each segment that ends still
 * inside it. A viewer reading one segment at a time keeps the
 * quotation cue visible across the whole span.
 *
 * Only fires when the quoted run crosses two or more segments.
 *
 * Quote boundaries are detected directly from `word.text` — no
 * dependency on any tagger. Supports straight (`"` / `"`), curly
 * (`“` / `”`), and angled (`«` / `»`) pairs; the added quotes mirror
 * the pair the original quotation used.
 */
export class CarryQuotesEffect implements Effect {

  private static readonly QUOTE_PAIRS = new Map<string, string>([
    ['"', '"'],
    ['“', '”'],
    ['«', '»'],
  ]);

  constructor(
    private readonly segmentFilter: (segment: Segment) => boolean = () => true,
  ) {}

  apply(document: Document): Document {
    const edits = this.collectEdits(document);
    if (edits.size === 0) return document;
    return this.rebuildWithEdits(document, edits);
  }

  private collectEdits(document: Document): Map<string, WordEdit> {
    const edits = new Map<string, WordEdit>();
    for (const section of document.sections) {
      for (const run of this.collectQuoteRuns(section)) {
        if (!this.qualifiesForCarrying(run)) continue;
        this.scheduleEditsForRun(run, edits);
      }
    }
    return edits;
  }

  private collectQuoteRuns(section: Section): QuoteRun[] {
    const runs: QuoteRun[] = [];
    let openWords: Word[] = [];
    let openingChar: string | null = null;
    for (const word of this.flattenWords(section)) {
      if (openingChar === null) {
        const opener = this.openingCharOf(word.text);
        if (opener === null) continue;
        openWords = [word];
        openingChar = opener;
        if (this.endsWithCloseOf(word.text, opener)) {
          runs.push({ words: openWords, openingChar, closingChar: this.closingCharFor(opener) });
          openWords = [];
          openingChar = null;
        }
        continue;
      }
      openWords.push(word);
      if (this.endsWithCloseOf(word.text, openingChar)) {
        runs.push({ words: openWords, openingChar, closingChar: this.closingCharFor(openingChar) });
        openWords = [];
        openingChar = null;
      }
    }
    return runs;
  }

  private *flattenWords(section: Section): Generator<Word> {
    for (const segment of section.segments) {
      for (const line of segment.lines) {
        for (const word of line.words) {
          yield word;
        }
      }
    }
  }

  private openingCharOf(text: string): string | null {
    const first = text[0];
    if (first !== undefined && CarryQuotesEffect.QUOTE_PAIRS.has(first)) return first;
    return null;
  }

  private closingCharFor(openingChar: string): string {
    return CarryQuotesEffect.QUOTE_PAIRS.get(openingChar)!;
  }

  private endsWithCloseOf(text: string, openingChar: string): boolean {
    return text.endsWith(this.closingCharFor(openingChar));
  }

  private qualifiesForCarrying(run: QuoteRun): boolean {
    return this.runCrossesMultipleSegments(run);
  }

  private runCrossesMultipleSegments(run: QuoteRun): boolean {
    const firstSegmentId = run.words[0]!.getSegment().id;
    for (const word of run.words) {
      if (word.getSegment().id !== firstSegmentId) return true;
    }
    return false;
  }

  private scheduleEditsForRun(run: QuoteRun, edits: Map<string, WordEdit>): void {
    const segments = this.groupWordsBySegment(run.words);
    let index = 0;
    for (const words of segments.values()) {
      const isFirst = index === 0;
      const isLast = index === segments.size - 1;
      if (!isFirst) this.schedulePrepend(words[0]!.id, run.openingChar, edits);
      if (!isLast) this.scheduleAppend(words[words.length - 1]!.id, run.closingChar, edits);
      index++;
    }
  }

  private groupWordsBySegment(words: readonly Word[]): Map<string, Word[]> {
    const groups = new Map<string, Word[]>();
    for (const word of words) {
      const segmentId = word.getSegment().id;
      const list = groups.get(segmentId);
      if (list) {
        list.push(word);
      } else {
        groups.set(segmentId, [word]);
      }
    }
    return groups;
  }

  private schedulePrepend(wordId: string, char: string, edits: Map<string, WordEdit>): void {
    const edit = edits.get(wordId) ?? {};
    edit.prepend = char;
    edits.set(wordId, edit);
  }

  private scheduleAppend(wordId: string, char: string, edits: Map<string, WordEdit>): void {
    const edit = edits.get(wordId) ?? {};
    edit.append = char;
    edits.set(wordId, edit);
  }

  private rebuildWithEdits(document: Document, edits: Map<string, WordEdit>): Document {
    return document.with({
      sections: document.sections.map((section) =>
        section.with({
          segments: section.segments.map((segment) => this.rebuildSegment(segment, edits)),
        }),
      ),
    });
  }

  private rebuildSegment(segment: Segment, edits: Map<string, WordEdit>): Segment {
    if (!this.segmentFilter(segment)) return segment;
    return segment.with({
      lines: segment.lines.map((line) => this.rebuildLine(line, edits)),
    });
  }

  private rebuildLine(line: Line, edits: Map<string, WordEdit>): Line {
    return line.with({
      words: line.words.map((word) => this.applyEditTo(word, edits)),
    });
  }

  private applyEditTo(word: Word, edits: Map<string, WordEdit>): Word {
    const edit = edits.get(word.id);
    if (!edit) return word;
    const prepend = edit.prepend ?? '';
    const append = edit.append ?? '';
    if (prepend === '' && append === '') return word;
    return word.with({ displayText: prepend + word.displayText + append });
  }
}
