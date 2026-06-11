import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/document/Tag';
import { CssVariable } from '@modules/document/CssVariable';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import type { Section } from '@modules/document/Section';
import type { Document } from '@modules/document/Document';

export interface SegmentProps<M = unknown> {
  readonly lines: ReadonlyArray<Line>;
  readonly structureTags?: ReadonlySet<Tag> | undefined;
  readonly id?: string | undefined;
  /**
   * Optional explicit time. When present, `time` returns this verbatim;
   * otherwise `time` is derived from the segment's words. Lets a caller
   * decouple the segment's time window from its word boundaries (e.g.
   * to hold a segment on screen past its narration end).
   */
  readonly customTime?: TimeFragment | null | undefined;
  readonly metadata?: M | undefined;
}

export class Segment<M = unknown> {
  static readonly CSS_CLASS = 'segment';

  readonly lines: ReadonlyArray<Line>;
  readonly structureTags: ReadonlySet<Tag>;
  readonly id: string;
  readonly customTime: TimeFragment | null;
  readonly metadata: M | undefined;

  private _parent: Section | null = null;

  constructor(props: SegmentProps<M>) {
    this.lines = props.lines;
    this.structureTags = props.structureTags ?? new Set();
    this.id = props.id ?? crypto.randomUUID();
    this.customTime = props.customTime ?? null;
    this.metadata = props.metadata;
    for (const line of this.lines) {
      line.setParent(this);
    }
  }

  get time(): TimeFragment {
    if (this.customTime) return this.customTime;
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

  getCssVariables(currentTime: number): Record<string, string> {
    return {
      [CssVariable.SEGMENT_STARTS]: `${(this.time.start - currentTime).toFixed(3)}s`,
      [CssVariable.SEGMENT_ENDS]: `${(this.time.end - currentTime).toFixed(3)}s`,
      [CssVariable.SEGMENT_DURATION]: `${(this.time.end - this.time.start).toFixed(3)}s`,
    };
  }

  getWords(): Word[] {
    return this.lines.flatMap((line) => [...line.words]);
  }

  getText(): string {
    return this.lines.map((line) => line.getText()).join(' ');
  }

  with(changes: Partial<SegmentProps<M>>): Segment<M> {
    const segment = new Segment<M>({
      lines: this.lines,
      structureTags: this.structureTags,
      id: this.id,
      customTime: this.customTime,
      metadata: this.metadata,
      ...changes,
    });
    segment._parent = this._parent;
    return segment;
  }

  withMetadata<N>(metadata: N): Segment<N> {
    const segment = new Segment<N>({
      lines: this.lines,
      structureTags: this.structureTags,
      id: this.id,
      customTime: this.customTime,
      metadata,
    });
    segment._parent = this._parent;
    return segment;
  }

  setParent(section: Section): void {
    this._parent = section;
  }

  getSection(): Section {
    if (!this._parent) throw new Error('Segment has no parent Section');
    return this._parent;
  }

  getDocument(): Document {
    return this.getSection().getDocument();
  }
}
