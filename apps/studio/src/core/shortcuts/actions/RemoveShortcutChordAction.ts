import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { KeymapOverridesEditor } from '@core/shortcuts/services/KeymapOverridesEditor';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import type { SaveKeymapOverridesAction } from '@core/shortcuts/actions/SaveKeymapOverridesAction';

/** Takes one chord away from a command and keeps the choice. A command may end up with none. */
export class RemoveShortcutChordAction {

  constructor(
    private readonly store: KeymapStore,
    private readonly editor: KeymapOverridesEditor,
    private readonly save: SaveKeymapOverridesAction,
  ) {}

  execute(input: { commandId: ShortcutCommandId; chord: KeyChord }): void {
    this.save.execute(this.editor.remove(this.store.keymap, this.store.overrides, input.commandId, input.chord));
  }
}
