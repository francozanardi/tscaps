import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { Keymap } from '@core/shortcuts/domain/Keymap';
import type { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import type { ShortcutConflictFinder } from '@core/shortcuts/services/ShortcutConflictFinder';

/**
 * Works out the user's choices after one change to the keymap. Pure: it
 * answers the next overrides and changes nothing.
 *
 * A command whose chords end up equal to its defaults loses its entry,
 * so the stored choices only ever hold what differs from the defaults
 * and a later change to a default reaches everyone who never touched it.
 */
export class KeymapOverridesEditor {

  constructor(
    private readonly catalog: ShortcutCatalog,
    private readonly conflictFinder: ShortcutConflictFinder,
  ) {}

  /**
   * Gives `chord` to the command, in place of `replacing` when one is
   * named and after its other chords otherwise. Every command it would
   * collide with gives the chord up, so a chord never means two things
   * at once.
   */
  assign(
    keymap: Keymap,
    overrides: KeymapOverrides,
    commandId: ShortcutCommandId,
    chord: KeyChord,
    replacing: KeyChord | null,
  ): KeymapOverrides {
    let next = overrides;
    for (const conflict of this.conflictFinder.conflictsOf(keymap, commandId, chord)) {
      next = this.settle(next, conflict.id, this.chordsWithout(keymap.chordsFor(conflict.id), chord));
    }
    return this.settle(next, commandId, this.chordsWith(keymap.chordsFor(commandId), chord, replacing));
  }

  remove(keymap: Keymap, overrides: KeymapOverrides, commandId: ShortcutCommandId, chord: KeyChord): KeymapOverrides {
    return this.settle(overrides, commandId, this.chordsWithout(keymap.chordsFor(commandId), chord));
  }

  reset(overrides: KeymapOverrides, commandId: ShortcutCommandId): KeymapOverrides {
    return overrides.without(commandId);
  }

  private chordsWith(current: readonly KeyChord[], chord: KeyChord, replacing: KeyChord | null): KeyChord[] {
    if (replacing?.equals(chord)) return [...current];
    const kept = this.chordsWithout(current, chord);
    const replacedAt = replacing ? kept.findIndex((candidate) => candidate.equals(replacing)) : -1;
    if (replacedAt < 0) return [...kept, chord];
    kept[replacedAt] = chord;
    return kept;
  }

  private chordsWithout(current: readonly KeyChord[], chord: KeyChord): KeyChord[] {
    return current.filter((candidate) => !candidate.equals(chord));
  }

  private settle(overrides: KeymapOverrides, commandId: ShortcutCommandId, chords: readonly KeyChord[]): KeymapOverrides {
    const defaults = this.catalog.get(commandId).defaultChords;
    if (this.sameChords(chords, defaults)) return overrides.without(commandId);
    return overrides.with(commandId, chords);
  }

  private sameChords(first: readonly KeyChord[], second: readonly KeyChord[]): boolean {
    if (first.length !== second.length) return false;
    return first.every((chord, index) => chord.equals(second[index]!));
  }
}
