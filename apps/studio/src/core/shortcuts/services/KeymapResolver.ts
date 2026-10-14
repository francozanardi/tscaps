import { Keymap } from '@core/shortcuts/domain/Keymap';
import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';

/**
 * Lays the user's choices over the catalog's defaults. An override for a
 * command the catalog does not know is ignored, and a command with no
 * override keeps its defaults.
 */
export class KeymapResolver {

  constructor(private readonly catalog: ShortcutCatalog) {}

  resolve(overrides: KeymapOverrides): Keymap {
    const chordsByCommandId = new Map<ShortcutCommandId, readonly KeyChord[]>();
    for (const command of this.catalog.list()) {
      chordsByCommandId.set(command.id, overrides.chordsFor(command.id) ?? command.defaultChords);
    }
    return new Keymap(chordsByCommandId);
  }
}
