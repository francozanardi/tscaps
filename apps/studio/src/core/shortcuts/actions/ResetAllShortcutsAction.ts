import { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import type { SaveKeymapOverridesAction } from '@core/shortcuts/actions/SaveKeymapOverridesAction';

/** Drops every keymap choice the user made, so each command answers to its defaults again. */
export class ResetAllShortcutsAction {

  constructor(private readonly save: SaveKeymapOverridesAction) {}

  execute(): void {
    this.save.execute(KeymapOverrides.empty());
  }
}
