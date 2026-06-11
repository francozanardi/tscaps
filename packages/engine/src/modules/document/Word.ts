import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/document/Tag';
import { WordState } from '@modules/document/WordState';
import { CssVariable } from '@modules/document/CssVariable';
import type { Line } from '@modules/document/Line';

export interface WordProps<M = unknown> {
  readonly text: string;
  readonly time: TimeFragment;
  readonly structureTags?: ReadonlySet<Tag> | undefined;
  readonly semanticTags?: ReadonlySet<Tag> | undefined;
  readonly id?: string | undefined;
  readonly displayText?: string | undefined;
  readonly speakerId?: string | null | undefined;
  readonly metadata?: M | undefined;
}

export class Word<M = unknown> {
  static readonly CSS_CLASS = 'word';

  readonly text: string;
  readonly time: TimeFragment;
  readonly structureTags: ReadonlySet<Tag>;
  readonly semanticTags: ReadonlySet<Tag>;
  readonly id: string;
  readonly displayText: string;
  readonly speakerId: string | null;
  readonly metadata: M | undefined;

  private _parent: Line | null = null;

  constructor(props: WordProps<M>) {
    this.text = props.text;
    this.time = props.time;
    this.structureTags = props.structureTags ?? new Set();
    this.semanticTags = props.semanticTags ?? new Set();
    this.id = props.id ?? crypto.randomUUID();
    this.displayText = props.displayText ?? props.text;
    this.speakerId = props.speakerId ?? null;
    this.metadata = props.metadata;
  }

  // Pure function — state is never stored, always computed
  getState(currentTime: number): WordState {
    if (this.time.isAfter(currentTime)) return WordState.NOT_NARRATED_YET;
    if (this.time.contains(currentTime)) return WordState.BEING_NARRATED;
    return WordState.ALREADY_NARRATED;
  }

  getCssClasses(currentTime: number): string[] {
    const classes: string[] = [Word.CSS_CLASS];

    classes.push(this.getState(currentTime));

    for (const tag of this.structureTags) {
      classes.push(tag.toCssClass());
    }

    for (const tag of this.semanticTags) {
      classes.push(tag.toCssClass());
    }

    return classes;
  }

  getCssVariables(currentTime: number): Record<string, string> {
    const segStart = this.getSegment().time.start;
    const segEnd = this.getSegment().time.end;
    const wordStart = this.time.start;
    const wordEnd = this.time.end;
    return {
      [CssVariable.WORD_NOT_NARRATED_YET_STARTS]: `${(segStart - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_NOT_NARRATED_YET_ENDS]: `${(wordStart - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_NOT_NARRATED_YET_DURATION]: `${(wordStart - segStart).toFixed(3)}s`,

      [CssVariable.WORD_BEING_NARRATED_STARTS]: `${(wordStart - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_BEING_NARRATED_ENDS]: `${(wordEnd - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_BEING_NARRATED_DURATION]: `${(wordEnd - wordStart).toFixed(3)}s`,

      [CssVariable.WORD_ALREADY_NARRATED_STARTS]: `${(wordEnd - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_ALREADY_NARRATED_ENDS]: `${(segEnd - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_ALREADY_NARRATED_DURATION]: `${(segEnd - wordEnd).toFixed(3)}s`,
    };
  }

  getAllTags(): ReadonlySet<Tag> {
    return new Set([...this.structureTags, ...this.semanticTags]);
  }

  hasTag(tag: Tag): boolean {
    return this.structureTags.has(tag) || this.semanticTags.has(tag);
  }

  hasTagName(name: string): boolean {
    return this.hasTag(Tag.of(name));
  }

  with(changes: Partial<WordProps<M>>): Word<M> {
    const word = new Word<M>({
      text: this.text,
      time: this.time,
      structureTags: this.structureTags,
      semanticTags: this.semanticTags,
      id: this.id,
      displayText: this.displayText,
      speakerId: this.speakerId,
      metadata: this.metadata,
      ...changes,
    });
    word._parent = this._parent;
    return word;
  }

  withMetadata<N>(metadata: N): Word<N> {
    const word = new Word<N>({
      text: this.text,
      time: this.time,
      structureTags: this.structureTags,
      semanticTags: this.semanticTags,
      id: this.id,
      displayText: this.displayText,
      speakerId: this.speakerId,
      metadata,
    });
    word._parent = this._parent;
    return word;
  }

  setParent(line: Line): void {
    this._parent = line;
  }

  getLine(): Line {
    if (!this._parent) throw new Error('Word has no parent Line');
    return this._parent;
  }

  getSegment() {
    return this.getLine().getSegment();
  }

  getDocument() {
    return this.getLine().getDocument();
  }
}
