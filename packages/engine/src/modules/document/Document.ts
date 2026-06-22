import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { NarrationPace } from '@modules/document/NarrationPace';

export interface DocumentProps<M = unknown> {
  readonly sections: ReadonlyArray<Section>;
  readonly metadata?: M | undefined;
  readonly narrationPace?: NarrationPace | undefined;
}

export class Document<M = unknown> {
  readonly sections: ReadonlyArray<Section>;
  readonly metadata: M | undefined;
  readonly narrationPace: NarrationPace;

  constructor(props: DocumentProps<M>) {
    this.sections = props.sections;
    this.metadata = props.metadata;
    this.narrationPace = props.narrationPace ?? NarrationPace.empty();
  }

  getSegments(): Segment[] {
    return this.sections.flatMap((section) => [...section.segments]);
  }

  getWords(): Word[] {
    return this.sections.flatMap((section) => section.getWords());
  }

  getLines(): Line[] {
    return this.sections.flatMap((section) => section.getLines());
  }

  getText(): string {
    return this.sections.map((section) => section.getText()).join(' ');
  }

  with(changes: Partial<DocumentProps<M>>): Document<M> {
    return new Document<M>({
      sections: this.sections,
      metadata: this.metadata,
      narrationPace: this.narrationPace,
      ...changes,
    });
  }

  /**
   * Builds a new Document with the given segments wrapped in a single
   * Section with an empty kind. Callers that need to preserve a
   * multi-Section topology should use `with({ sections })` instead.
   */
  withSegments(segments: ReadonlyArray<Segment>): Document<M> {
    return new Document<M>({
      sections: [new Section({ segments, kind: '' })],
      metadata: this.metadata,
    });
  }

  withMetadata<N>(metadata: N): Document<N> {
    return new Document<N>({ sections: this.sections, metadata });
  }

  /**
   * Returns every segment whose time window contains `currentTime`,
   * sorted by start time (then by end time, then by document order).
   * When segments overlap in time this can yield more than one;
   * non-overlapping content degenerates to a 0/1-length array. The sort
   * is stable across frames so consumers can derive cache keys from the
   * order.
   *
   * The interval is half-open `[start, end)` — see TimeFragment. At a
   * shared boundary `segA.end === segB.start`, only `segB` is active.
   */
  getActiveSegments(currentTime: number): Segment[] {
    const flat = this.getSegments();
    const active: { seg: Segment; flatIdx: number }[] = [];
    for (let i = 0; i < flat.length; i++) {
      const seg = flat[i]!;
      if (seg.time.contains(currentTime)) active.push({ seg, flatIdx: i });
    }
    active.sort((a, b) => {
      const ds = a.seg.time.start - b.seg.time.start;
      if (ds !== 0) return ds;
      const de = a.seg.time.end - b.seg.time.end;
      if (de !== 0) return de;
      return a.flatIdx - b.flatIdx;
    });
    return active.map((e) => e.seg);
  }

  /** Mirrors {@link getActiveSegments} at the section level. */
  getActiveSections(currentTime: number): Section[] {
    return this.sections
      .filter((section) => section.time.contains(currentTime))
      .sort((a, b) => a.time.start - b.time.start || a.time.end - b.time.end);
  }
}
