import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/document/Tag';
import { WordState } from '@modules/document/WordState';
import { CssVariable } from '@modules/document/CssVariable';
import { Decoration } from '@modules/document/Decoration';

export interface WordProps<M = unknown> {
  readonly text: string;
  readonly time: TimeFragment;
  readonly structureTags?: ReadonlySet<Tag> | undefined;
  readonly semanticTags?: ReadonlySet<Tag> | undefined;
  readonly id?: string | undefined;
  readonly displayText?: string | undefined;
  readonly speakerId?: string | null | undefined;
  readonly decoration?: Decoration | null | undefined;
  readonly metadata?: M | undefined;
}

/**
 * Render-time context the word needs from its ancestors to emit its
 * timing variables.
 */
export interface WordRenderContext {
  readonly segTime: TimeFragment;
  readonly indexInLine: number;
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
  readonly decoration: Decoration | null;
  readonly metadata: M | undefined;

  constructor(props: WordProps<M>) {
    this.text = props.text;
    this.time = props.time;
    this.structureTags = props.structureTags ?? new Set();
    this.semanticTags = props.semanticTags ?? new Set();
    this.id = props.id ?? crypto.randomUUID();
    this.displayText = props.displayText ?? props.text;
    this.speakerId = props.speakerId ?? null;
    this.decoration = props.decoration ?? null;
    this.metadata = props.metadata;
  }

  getState(currentTime: number): WordState {
    if (this.time.isAfter(currentTime)) return WordState.NOT_NARRATED_YET;
    if (this.time.contains(currentTime)) return WordState.BEING_NARRATED;
    return WordState.ALREADY_NARRATED;
  }

  getCssClasses(currentTime: number): string[] {
    const classes: string[] = [Word.CSS_CLASS, this.getState(currentTime)];
    for (const tag of this.structureTags) classes.push(tag.toCssClass());
    for (const tag of this.semanticTags) classes.push(tag.toCssClass());
    return classes;
  }

  getCssVariables(currentTime: number, ctx: WordRenderContext): Record<string, string> {
    const segStart = ctx.segTime.start;
    const segEnd = ctx.segTime.end;
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

      [CssVariable.WORD_INDEX]: String(ctx.indexInLine),
      [CssVariable.WORD_CHAR_COUNT]: String([...this.displayText].length),
    };
  }

  getAllTags(): ReadonlySet<Tag> {
    return new Set([...this.structureTags, ...this.semanticTags]);
  }

  hasTag(tag: Tag): boolean {
    return this.hasTagName(tag.name);
  }

  hasTagName(name: string): boolean {
    return this._anyTagNamed(this.structureTags, name) || this._anyTagNamed(this.semanticTags, name);
  }

  private _anyTagNamed(tags: ReadonlySet<Tag>, name: string): boolean {
    for (const tag of tags) {
      if (tag.name === name) return true;
    }
    return false;
  }

  with(changes: Partial<WordProps<M>>): Word<M> {
    return new Word<M>({
      text: this.text,
      time: this.time,
      structureTags: this.structureTags,
      semanticTags: this.semanticTags,
      id: this.id,
      displayText: this.displayText,
      speakerId: this.speakerId,
      decoration: this.decoration,
      metadata: this.metadata,
      ...changes,
    });
  }

  withMetadata<N>(metadata: N): Word<N> {
    return new Word<N>({
      text: this.text,
      time: this.time,
      structureTags: this.structureTags,
      semanticTags: this.semanticTags,
      id: this.id,
      displayText: this.displayText,
      speakerId: this.speakerId,
      decoration: this.decoration,
      metadata,
    });
  }
}
