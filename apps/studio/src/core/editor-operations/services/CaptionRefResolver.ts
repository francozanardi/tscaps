import type { Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { EditorRefKind } from '@core/editor-operations/domain/EditorRef';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';

/** The caption kinds a ref can name. */
export type CaptionRefKind = Extract<EditorRefKind, 'segment' | 'line' | 'word' | 'decoration'>;

/** A caption node a ref named: its kind and id, its text, and when it shows, in seconds of the source video. */
export interface CaptionElement {
  readonly kind: CaptionRefKind & ElementKind;
  readonly id: string;
  readonly ref: string;
  readonly text: string;
  readonly startSec: number;
  readonly endSec: number;
}

const CAPTION_KINDS: ReadonlySet<string> = new Set<CaptionRefKind>(['segment', 'line', 'word', 'decoration']);

/**
 * Finds the caption node a ref names in the captions on screen now (the
 * active caption track). A word keeps its id for good; a segment keeps it
 * only while its words stay the same, and a line's changes whenever the
 * captions reflow, so a ref read earlier can be gone: the answer then
 * says so and tells the caller to read the captions again.
 */
export class CaptionRefResolver {
  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
  ) {}

  /** The caption node `text` names, of one of `kinds` (any caption kind when omitted). */
  resolve(text: string, kinds: ReadonlyArray<CaptionRefKind> = ['segment', 'line', 'word', 'decoration']): ResolvedRef<CaptionElement> {
    const ref = this.parser.parse(text);
    if (ref === null || !CAPTION_KINDS.has(ref.kind)) {
      return this.problem(text, `"${text}" is not a caption ref; caption refs look like segment:<id>, line:<id>, word:<id> or decoration:<id>.`);
    }
    if (!kinds.includes(ref.kind as CaptionRefKind)) {
      return this.problem(text, `${text} is a ${ref.kind}; this needs a ${kinds.join(' or ')}.`);
    }
    const document = this.store.snapshot().document;
    if (document === null) return this.problem(text, 'The project has no captions yet.');
    const element = this.find(document, ref.kind as CaptionRefKind, ref.id);
    if (element === null) {
      return this.problem(text, `${text} is not in the captions any more (captions can be re-split after edits); read the transcript again for current refs.`);
    }
    return { ok: true, value: element };
  }

  private find(document: Document, kind: CaptionRefKind, id: string): CaptionElement | null {
    switch (kind) {
      case 'segment': {
        const segment = document.getSegments().find((each) => each.id === id);
        return segment === undefined ? null : this.elementOf('segment', id, segment.getText(), segment.time.start, segment.time.end);
      }
      case 'line': {
        const line = document.getLines().find((each) => each.id === id);
        return line === undefined ? null : this.elementOf('line', id, line.getText(), line.time.start, line.time.end);
      }
      case 'word': {
        const word = document.getWords().find((each) => each.id === id);
        return word === undefined ? null : this.elementOf('word', id, word.text, word.time.start, word.time.end);
      }
      case 'decoration': {
        const word = document.getWords().find((each) => each.decoration?.id === id);
        if (word === undefined || word.decoration === null) return null;
        return this.elementOf('decoration', id, word.decoration.glyph, word.time.start, word.time.end);
      }
    }
  }

  private elementOf(kind: CaptionRefKind, id: string, text: string, startSec: number, endSec: number): CaptionElement {
    return { kind, id, ref: this.parser.formatOf(kind, id), text, startSec, endSec };
  }

  private problem(ref: string, message: string): ResolvedRef<CaptionElement> {
    return { ok: false, problem: { severity: 'error', message, ref } };
  }
}
