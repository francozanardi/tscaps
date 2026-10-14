import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';

/**
 * The chords every command answers to right now: the defaults, with the
 * user's choices laid over them. Immutable.
 */
export class Keymap {

  constructor(private readonly chordsByCommandId: ReadonlyMap<ShortcutCommandId, readonly KeyChord[]>) {}

  /** The command's chords, first one first. Empty when it has none. */
  chordsFor(commandId: ShortcutCommandId): readonly KeyChord[] {
    return this.chordsByCommandId.get(commandId) ?? [];
  }

  /** Every command bound to the chord, whatever its scope. */
  commandsBoundTo(chord: KeyChord): ShortcutCommandId[] {
    const commandIds: ShortcutCommandId[] = [];
    for (const [commandId, chords] of this.chordsByCommandId) {
      if (chords.some((candidate) => candidate.equals(chord))) commandIds.push(commandId);
    }
    return commandIds;
  }
}
