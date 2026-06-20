import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/document/Tag';
import { LineState } from '@modules/document/LineState';
import { CssVariable } from '@modules/document/CssVariable';
import { Word } from '@modules/document/Word';
import type { Segment } from '@modules/document/Segment';

export interface LineProps<M = unknown> {
  readonly words: ReadonlyArray<Word>;
  readonly structureTags?: ReadonlySet<Tag> | undefined;
  readonly id?: string | undefined;
  readonly metadata?: M | undefined;
}

export class Line<M = unknown> {
  static readonly CSS_CLASS = 'line';

  readonly words: ReadonlyArray<Word>;
  readonly structureTags: ReadonlySet<Tag>;
  readonly id: string;
  readonly metadata: M | undefined;

  private _parent: Segment | null = null;

  constructor(props: LineProps<M>) {
    this.words = props.words;
    this.structureTags = props.structureTags ?? new Set();
    this.id = props.id ?? crypto.randomUUID();
    this.metadata = props.metadata;
    for (const word of this.words) {
      word.setParent(this);
    }
  }

  get time(): TimeFragment {
    const first = this.words[0];
    const last = this.words[this.words.length - 1];
    if (!first || !last) throw new Error('Line has no words');
    return new TimeFragment(first.time.start, last.time.end);
  }

  getState(currentTime: number): LineState {
    if (this.time.isAfter(currentTime)) return LineState.NOT_NARRATED_YET;
    if (this.time.contains(currentTime)) return LineState.BEING_NARRATED;
    return LineState.ALREADY_NARRATED;
  }

  getCssClasses(currentTime: number): string[] {
    const classes: string[] = [Line.CSS_CLASS, this.getState(currentTime)];
    for (const tag of this.structureTags) {
      classes.push(tag.toCssClass());
    }
    return classes;
  }

  getCssVariables(currentTime: number): Record<string, string> {
    const segStart = this.getSegment().time.start;
    const segEnd = this.getSegment().time.end;
    const lineStart = this.time.start;
    const lineEnd = this.time.end;
    return {
      [CssVariable.LINE_NOT_NARRATED_YET_STARTS]: `${(segStart - currentTime).toFixed(3)}s`,
      [CssVariable.LINE_NOT_NARRATED_YET_ENDS]: `${(lineStart - currentTime).toFixed(3)}s`,
      [CssVariable.LINE_NOT_NARRATED_YET_DURATION]: `${(lineStart - segStart).toFixed(3)}s`,

      [CssVariable.LINE_BEING_NARRATED_STARTS]: `${(lineStart - currentTime).toFixed(3)}s`,
      [CssVariable.LINE_BEING_NARRATED_ENDS]: `${(lineEnd - currentTime).toFixed(3)}s`,
      [CssVariable.LINE_BEING_NARRATED_DURATION]: `${(lineEnd - lineStart).toFixed(3)}s`,

      [CssVariable.LINE_ALREADY_NARRATED_STARTS]: `${(lineEnd - currentTime).toFixed(3)}s`,
      [CssVariable.LINE_ALREADY_NARRATED_ENDS]: `${(segEnd - currentTime).toFixed(3)}s`,
      [CssVariable.LINE_ALREADY_NARRATED_DURATION]: `${(segEnd - lineEnd).toFixed(3)}s`,

      [CssVariable.WORD_COUNT]: String(this.words.length),
      [CssVariable.LAST_WORD_CHAR_COUNT]: String(this.getLastWordCharCount()),
    };
  }

  private getLastWordCharCount(): number {
    const last = this.words[this.words.length - 1];
    return last ? [...last.displayText].length : 0;
  }

  getText(): string {
    return this.words.map((w) => w.text).join(' ');
  }

  with(changes: Partial<LineProps<M>>): Line<M> {
    const line = new Line<M>({
      words: this.words,
      structureTags: this.structureTags,
      id: this.id,
      metadata: this.metadata,
      ...changes,
    });
    line._parent = this._parent;
    return line;
  }

  withMetadata<N>(metadata: N): Line<N> {
    const line = new Line<N>({
      words: this.words,
      structureTags: this.structureTags,
      id: this.id,
      metadata,
    });
    line._parent = this._parent;
    return line;
  }

  setParent(segment: Segment): void {
    this._parent = segment;
  }

  getSegment(): Segment {
    if (!this._parent) throw new Error('Line has no parent Segment');
    return this._parent;
  }

  getDocument() {
    return this.getSegment().getDocument();
  }
}
