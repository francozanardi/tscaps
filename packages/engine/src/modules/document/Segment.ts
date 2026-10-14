import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/tags/Tag';
import { CssVariable } from '@modules/document/CssVariable';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { DocumentNodeId } from '@modules/document/DocumentNodeId';

export interface SegmentProps<M = unknown> {
  readonly lines: ReadonlyArray<Line>;
  readonly structureTags?: ReadonlySet<Tag> | undefined;
  readonly id?: string | undefined;
  /** Window a caller named, decoupling the segment from its word boundaries. */
  readonly customTime?: TimeFragment | null | undefined;
  /** Window an Effect computed. Effects overwrite it wholesale and never read it back. */
  readonly effectTime?: TimeFragment | null | undefined;
  /** Defaults to `false`. */
  readonly hidden?: boolean | undefined;
  readonly metadata?: M | undefined;
}

/**
 * Render-time context the segment needs from its ancestors to emit
 * its variables.
 */
export interface SegmentRenderContext {
  readonly indexInSection: number;
}

export class Segment<M = unknown> {
  static readonly CSS_CLASS = 'segment';

  readonly lines: ReadonlyArray<Line>;
  readonly structureTags: ReadonlySet<Tag>;
  readonly id: string;
  readonly customTime: TimeFragment | null;
  readonly effectTime: TimeFragment | null;
  /** Kept in the document but never painted, nor a neighbour to Effects. */
  readonly hidden: boolean;
  readonly metadata: M | undefined;

  constructor(props: SegmentProps<M>) {
    this.lines = props.lines;
    this.structureTags = props.structureTags ?? new Set();
    this.id = props.id ?? DocumentNodeId.generate();
    this.customTime = props.customTime ?? null;
    this.effectTime = props.effectTime ?? null;
    this.hidden = props.hidden ?? false;
    this.metadata = props.metadata;
  }

  /**
   * The window the segment is on screen for: an explicit one if a
   * caller named it, otherwise an Effect's if one shaped it, otherwise
   * the span of its own words.
   */
  get time(): TimeFragment {
    if (this.customTime) return this.customTime;
    if (this.effectTime) return this.effectTime;
    return this.wordTime;
  }

  /** The span of the segment's own words, ignoring any imposed window. */
  get wordTime(): TimeFragment {
    const first = this.lines[0];
    const last = this.lines[this.lines.length - 1];
    if (!first || !last) throw new Error('Segment has no lines');
    return new TimeFragment(first.time.start, last.time.end);
  }

  getCssClasses(_currentTime: number): string[] {
    const classes: string[] = [Segment.CSS_CLASS];
    for (const tag of this.structureTags) {
      classes.push(tag.toCssClass());
    }
    return classes;
  }

  getCssVariables(currentTime: number, ctx: SegmentRenderContext): Record<string, string> {
    return {
      [CssVariable.SEGMENT_STARTS]: `${(this.time.start - currentTime).toFixed(3)}s`,
      [CssVariable.SEGMENT_ENDS]: `${(this.time.end - currentTime).toFixed(3)}s`,
      [CssVariable.SEGMENT_DURATION]: `${(this.time.end - this.time.start).toFixed(3)}s`,
      [CssVariable.SEGMENT_CHAR_COUNT]: String(this.getText().length),
      [CssVariable.SEGMENT_INDEX]: String(ctx.indexInSection),
      [CssVariable.WORD_COUNT]: String(this.getWordCount()),
      [CssVariable.LAST_WORD_CHAR_COUNT]: String(this.getLastWordCharCount()),
    };
  }

  private getWordCount(): number {
    return this.lines.reduce((sum, line) => sum + line.words.length, 0);
  }

  private getLastWordCharCount(): number {
    const lastLine = this.lines[this.lines.length - 1];
    const lastWord = lastLine?.words[lastLine.words.length - 1];
    return lastWord ? [...lastWord.displayText].length : 0;
  }

  getWords(): Word[] {
    return this.lines.flatMap((line) => [...line.words]);
  }

  /** Union of the segment's own structure tags and every one of its words' tags. */
  getAllTags(): ReadonlySet<Tag> {
    const tags = new Set<Tag>(this.structureTags);
    for (const word of this.getWords()) {
      for (const tag of word.getAllTags()) tags.add(tag);
    }
    return tags;
  }

  getText(): string {
    return this.lines.map((line) => line.getText()).join(' ');
  }

  with(changes: Partial<SegmentProps<M>>): Segment<M> {
    return new Segment<M>({
      lines: this.lines,
      structureTags: this.structureTags,
      id: this.id,
      customTime: this.customTime,
      effectTime: this.effectTime,
      hidden: this.hidden,
      metadata: this.metadata,
      ...changes,
    });
  }

  withMetadata<N>(metadata: N): Segment<N> {
    return new Segment<N>({
      lines: this.lines,
      structureTags: this.structureTags,
      id: this.id,
      customTime: this.customTime,
      effectTime: this.effectTime,
      hidden: this.hidden,
      metadata,
    });
  }
}
