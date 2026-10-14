import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { Keymap } from '@core/shortcuts/domain/Keymap';
import type { ShortcutCommand } from '@core/shortcuts/domain/ShortcutCommand';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutScope } from '@core/shortcuts/domain/ShortcutScope';
import type { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';

/**
 * Answers which commands a chord would collide with if it were given to
 * another command. Two commands collide when they share a chord and can
 * be live at the same moment; the two editing modes never are, so a
 * chord may mean one thing in each.
 */
export class ShortcutConflictFinder {

  constructor(private readonly catalog: ShortcutCatalog) {}

  /** The other commands already bound to `chord` that would fire alongside `commandId`. */
  conflictsOf(keymap: Keymap, commandId: ShortcutCommandId, chord: KeyChord): ShortcutCommand[] {
    const scope = this.catalog.get(commandId).scope;
    return keymap.commandsBoundTo(chord)
      .filter((otherId) => otherId !== commandId)
      .map((otherId) => this.catalog.get(otherId))
      .filter((other) => this.scopesOverlap(scope, other.scope));
  }

  private scopesOverlap(first: ShortcutScope, second: ShortcutScope): boolean {
    if (first === second) return true;
    return !this.isEditingMode(first) || !this.isEditingMode(second);
  }

  private isEditingMode(scope: ShortcutScope): boolean {
    return scope === 'transcript' || scope === 'timeline';
  }
}
