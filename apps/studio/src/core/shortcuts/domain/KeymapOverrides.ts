import type { KeyChord } from '@core/shortcuts/domain/KeyChord';

/**
 * The chords the user chose in place of a command's defaults, by command
 * id. A command with no entry keeps its defaults; an entry with no chords
 * means the user unbound it.
 *
 * Ids are plain strings rather than known command ids so that an entry
 * for a command this build does not have survives a round trip through
 * storage instead of being dropped by whichever build read it first.
 *
 * Immutable: every change answers a new instance.
 */
export class KeymapOverrides {

  private constructor(private readonly chordsByCommandId: ReadonlyMap<string, readonly KeyChord[]>) {}

  static empty(): KeymapOverrides {
    return new KeymapOverrides(new Map());
  }

  static fromEntries(entries: Iterable<readonly [string, readonly KeyChord[]]>): KeymapOverrides {
    return new KeymapOverrides(new Map(entries));
  }

  /** The user's chords for a command, or `null` when it keeps its defaults. */
  chordsFor(commandId: string): readonly KeyChord[] | null {
    return this.chordsByCommandId.get(commandId) ?? null;
  }

  with(commandId: string, chords: readonly KeyChord[]): KeymapOverrides {
    const next = new Map(this.chordsByCommandId);
    next.set(commandId, chords);
    return new KeymapOverrides(next);
  }

  without(commandId: string): KeymapOverrides {
    if (!this.chordsByCommandId.has(commandId)) return this;
    const next = new Map(this.chordsByCommandId);
    next.delete(commandId);
    return new KeymapOverrides(next);
  }

  isEmpty(): boolean {
    return this.chordsByCommandId.size === 0;
  }

  entries(): Array<readonly [string, readonly KeyChord[]]> {
    return Array.from(this.chordsByCommandId.entries());
  }
}
