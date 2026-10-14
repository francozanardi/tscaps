import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { KeymapOverridesEditor } from '@core/shortcuts/services/KeymapOverridesEditor';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import type { SaveKeymapOverridesAction } from '@core/shortcuts/actions/SaveKeymapOverridesAction';

/**
 * Gives a command its default chords back. Another command that was
 * given one of those chords since keeps it, so the two may collide
 * until the user settles which one has it.
 */
export class ResetShortcutAction {

  constructor(
    private readonly store: KeymapStore,
    private readonly editor: KeymapOverridesEditor,
    private readonly save: SaveKeymapOverridesAction,
  ) {}

  execute(commandId: ShortcutCommandId): void {
    this.save.execute(this.editor.reset(this.store.overrides, commandId));
  }
}
