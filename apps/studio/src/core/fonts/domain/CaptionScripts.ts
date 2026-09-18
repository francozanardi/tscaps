import type { FontScript } from '@core/fonts/domain/FontScript';

/** Derived script presence and picker order, plus the Arabic-script writing tradition. */
export class CaptionScripts {

  /** No captions read yet, which leads with Latin and carries nothing else. */
  static none(): CaptionScripts {
    return new CaptionScripts(null, new Set(), false, new Set());
  }

  constructor(
    readonly leading: FontScript | null,
    readonly present: ReadonlySet<FontScript>,
    readonly readsAsUrdu: boolean = leading === 'urdu',
    readonly otherLetterCodepoints: ReadonlySet<number> = new Set(),
  ) {}

  get hasOtherLetters(): boolean {
    return this.otherLetterCodepoints.size > 0;
  }

  equals(other: CaptionScripts): boolean {
    return this.readsAsUrdu === other.readsAsUrdu
      && this.leading === other.leading
      && this.present.size === other.present.size
      && [...this.present].every((script) => other.present.has(script))
      && this.otherLetterCodepoints.size === other.otherLetterCodepoints.size
      && [...this.otherLetterCodepoints].every((point) => other.otherLetterCodepoints.has(point));
  }
}
