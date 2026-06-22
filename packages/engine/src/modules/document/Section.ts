import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/document/Tag';
import { CssVariable } from '@modules/document/CssVariable';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';

export interface SectionProps<M = unknown> {
  readonly segments: ReadonlyArray<Segment>;
  readonly kind: string;
  readonly structureTags?: ReadonlySet<Tag> | undefined;
  readonly id?: string | undefined;
  readonly metadata?: M | undefined;
}

/**
 * A Section is a contiguous run of Segments inside a Document. It is the unit
 * at which the structural pipeline (segment/line splitters, taggers) is
 * intended to operate: each Section can carry an independent layout rationale.
 *
 * Sits between Document and Segment in the hierarchy. Identity is unique
 * (`id`); a separate opaque `kind` is the grouping discriminator —
 * adjacent Sections that share `kind` are kept merged into one. Consumers
 * give `kind` whatever semantics they need (e.g., styling lookup); the
 * engine treats it as an opaque string.
 */
export class Section<M = unknown> {
  static readonly CSS_CLASS = 'section';

  readonly segments: ReadonlyArray<Segment>;
  readonly kind: string;
  readonly structureTags: ReadonlySet<Tag>;
  readonly id: string;
  readonly metadata: M | undefined;

  constructor(props: SectionProps<M>) {
    this.segments = props.segments;
    this.kind = props.kind;
    this.structureTags = props.structureTags ?? new Set();
    this.id = props.id ?? crypto.randomUUID();
    this.metadata = props.metadata;
  }

  get time(): TimeFragment {
    const first = this.segments[0];
    const last = this.segments[this.segments.length - 1];
    if (!first || !last) throw new Error('Section has no segments');
    return new TimeFragment(first.time.start, last.time.end);
  }

  getCssClasses(_currentTime: number): string[] {
    const classes: string[] = [Section.CSS_CLASS];
    for (const tag of this.structureTags) {
      classes.push(tag.toCssClass());
    }
    return classes;
  }

  getCssVariables(currentTime: number): Record<string, string> {
    return {
      [CssVariable.SECTION_STARTS]: `${(this.time.start - currentTime).toFixed(3)}s`,
      [CssVariable.SECTION_ENDS]: `${(this.time.end - currentTime).toFixed(3)}s`,
      [CssVariable.SECTION_DURATION]: `${(this.time.end - this.time.start).toFixed(3)}s`,
    };
  }

  getWords(): Word[] {
    return this.segments.flatMap((segment) => segment.getWords());
  }

  getLines(): Line[] {
    return this.segments.flatMap((segment) => [...segment.lines]);
  }

  getText(): string {
    return this.segments.map((segment) => segment.getText()).join(' ');
  }

  with(changes: Partial<SectionProps<M>>): Section<M> {
    return new Section<M>({
      segments: this.segments,
      kind: this.kind,
      structureTags: this.structureTags,
      id: this.id,
      metadata: this.metadata,
      ...changes,
    });
  }

  withMetadata<N>(metadata: N): Section<N> {
    return new Section<N>({
      segments: this.segments,
      kind: this.kind,
      structureTags: this.structureTags,
      id: this.id,
      metadata,
    });
  }
}
