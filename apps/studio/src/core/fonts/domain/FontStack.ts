import { FONT_SCRIPTS, type FontFaceSlot, type FontScript } from '@core/fonts/domain/FontScript';
import type { FontStackFaces } from '@core/fonts/domain/FontStackCatalog';
import { DEFAULT_OTHER_FONT_FAMILY } from '@core/fonts/domain/SystemFontFamily';

/** Plain shape for serialization. A face missing from it falls back to the stack it is read against. */
export type FontStackSnapshot = Readonly<Partial<Record<FontFaceSlot, string>>>;

export type CompleteFontStackSnapshot = FontStackFaces & Readonly<{ other: string }>;

/**
 * Which family draws each writing system. A template names one of the
 * catalog's stacks and the reader tunes its faces one at a time; every
 * face is independent, so changing the Latin one leaves the Arabic one
 * exactly where it was.
 *
 * Always complete: every managed script and the shared Other slot have a face. Immutable.
 */
export class FontStack {

  static of(faces: FontStackFaces): FontStack {
    return new FontStack(faces, DEFAULT_OTHER_FONT_FAMILY);
  }

  /**
   * The stored faces, with `fallback`'s face wherever the payload has
   * none that holds. A face that is not a name would lead a stack with
   * something unresolvable, and the line's metrics come from whatever
   * leads.
   */
  static fromSnapshot(value: unknown, fallback: FontStack): FontStack {
    const stored = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
    const faces = {} as Record<FontScript, string>;
    for (const script of FONT_SCRIPTS) {
      const held = stored[script];
      faces[script] = typeof held === 'string' && held.length > 0 ? held : fallback.familyFor(script);
    }
    const heldOther = stored.other;
    const other = typeof heldOther === 'string' && heldOther.length > 0
      ? heldOther
      : fallback.familyFor('other');
    return new FontStack(faces, other);
  }

  /**
   * A stack read back from somewhere that keeps no fallback to fill its
   * gaps, or `null` when the payload is not one face per script.
   *
   * All or nothing: a stack missing a face would silently paint that
   * writing system in whatever the device supplies, where no stack at
   * all leaves the element on what it inherits, which renders.
   */
  static fromStoredFaces(value: unknown): FontStack | null {
    if (value === null || typeof value !== 'object') return null;
    const stored = value as Record<string, unknown>;
    const faces = {} as Record<FontScript, string>;
    for (const script of FONT_SCRIPTS) {
      const held = stored[script];
      if (typeof held !== 'string' || held.length === 0) return null;
      faces[script] = held;
    }
    const heldOther = stored.other;
    const other = typeof heldOther === 'string' && heldOther.length > 0
      ? heldOther
      : DEFAULT_OTHER_FONT_FAMILY;
    return new FontStack(faces, other);
  }

  private constructor(
    private readonly faces: FontStackFaces,
    private readonly otherFamily: string,
  ) {}

  familyFor(slot: FontFaceSlot): string {
    return slot === 'other' ? this.otherFamily : this.faces[slot];
  }

  /** The same stack with one face replaced. */
  with(slot: FontFaceSlot, family: string): FontStack {
    return slot === 'other'
      ? new FontStack(this.faces, family)
      : new FontStack({ ...this.faces, [slot]: family }, this.otherFamily);
  }

  /** Plain CSS fallback list for contexts without registered composite families. */
  ledBy(script: FontScript): readonly string[] {
    const leader = this.familyFor(script);
    const rest = FONT_SCRIPTS.map((other) => this.faces[other]).filter((family) => family !== leader);
    return [leader, ...new Set(rest)];
  }

  toSnapshot(): CompleteFontStackSnapshot {
    return { ...this.faces, other: this.otherFamily };
  }

  /** Serializes the script-to-face record without the private storage wrapper. */
  toJSON(): CompleteFontStackSnapshot {
    return this.toSnapshot();
  }
}
