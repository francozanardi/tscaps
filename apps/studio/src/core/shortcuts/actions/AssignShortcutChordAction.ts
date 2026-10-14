import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { KeymapOverridesEditor } from '@core/shortcuts/services/KeymapOverridesEditor';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import type { SaveKeymapOverridesAction } from '@core/shortcuts/actions/SaveKeymapOverridesAction';

export interface AssignShortcutChordInput {
  readonly commandId: ShortcutCommandId;
  readonly chord: KeyChord;
  /** A chord of the command's to swap out; `null` adds the chord after the others. */
  readonly replacing: KeyChord | null;
}

/**
 * Binds a chord to a command and keeps the choice. Any command the chord
 * would collide with loses it in the same step, so the keymap never holds
 * a chord that means two things at once.
 */
export class AssignShortcutChordAction {

  constructor(
    private readonly store: KeymapStore,
    private readonly editor: KeymapOverridesEditor,
    private readonly save: SaveKeymapOverridesAction,
  ) {}

  execute(input: AssignShortcutChordInput): void {
    this.save.execute(this.editor.assign(
      this.store.keymap,
      this.store.overrides,
      input.commandId,
      input.chord,
      input.replacing,
    ));
  }
}
