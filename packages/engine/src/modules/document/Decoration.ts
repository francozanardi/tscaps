import { TimeFragment } from '@modules/document/TimeFragment';
import { CssVariable } from '@modules/document/CssVariable';
import type { Word } from '@modules/document/Word';

export interface DecorationProps {
  readonly id: string;
  readonly glyph: string;
  /** Effective time window. When `null`, falls back to the host word's time. */
  readonly customTime?: TimeFragment | null | undefined;
  /**
   * Trailing text rendered next to the glyph, outside the decoration's
   * own style scope so it inherits the host word's typography.
   */
  readonly trail?: string | undefined;
}

/**
 * A non-textual glyph attached to a word. Carries its own id so it can
 * be addressed as an independent target for per-element overrides
 * (size, position, rotation) and interaction bindings without becoming
 * a separate Word in the document hierarchy.
 *
 * The id is opaque; callers pick an encoding stable across document
 * re-derivation.
 */
export class Decoration {
  static readonly CSS_CLASS = 'word-decoration';

  readonly id: string;
  readonly glyph: string;
  readonly customTime: TimeFragment | null;
  readonly trail: string;

  private _parent: Word | null = null;

  constructor(props: DecorationProps) {
    this.id = props.id;
    this.glyph = props.glyph;
    this.customTime = props.customTime ?? null;
    this.trail = props.trail ?? '';
  }

  /** The decoration's `customTime` when set; otherwise the host word's time. */
  get time(): TimeFragment {
    if (this.customTime) return this.customTime;
    return this.getWord().time;
  }

  /** The `--on-word-*` time variables driven by this decoration's effective time. */
  getCssVariables(currentTime: number): Record<string, string> {
    const segStart = this.getSegment().time.start;
    const segEnd = this.getSegment().time.end;
    const start = this.time.start;
    const end = this.time.end;
    return {
      [CssVariable.WORD_NOT_NARRATED_YET_STARTS]: `${(segStart - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_NOT_NARRATED_YET_ENDS]: `${(start - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_NOT_NARRATED_YET_DURATION]: `${(start - segStart).toFixed(3)}s`,

      [CssVariable.WORD_BEING_NARRATED_STARTS]: `${(start - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_BEING_NARRATED_ENDS]: `${(end - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_BEING_NARRATED_DURATION]: `${(end - start).toFixed(3)}s`,

      [CssVariable.WORD_ALREADY_NARRATED_STARTS]: `${(end - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_ALREADY_NARRATED_ENDS]: `${(segEnd - currentTime).toFixed(3)}s`,
      [CssVariable.WORD_ALREADY_NARRATED_DURATION]: `${(segEnd - end).toFixed(3)}s`,
    };
  }

  with(changes: Partial<DecorationProps>): Decoration {
    const decoration = new Decoration({
      id: this.id,
      glyph: this.glyph,
      customTime: this.customTime,
      trail: this.trail,
      ...changes,
    });
    decoration._parent = this._parent;
    return decoration;
  }

  setParent(word: Word): void {
    this._parent = word;
  }

  getWord(): Word {
    if (!this._parent) throw new Error('Decoration has no parent Word');
    return this._parent;
  }

  getSegment() {
    return this.getWord().getSegment();
  }
}
