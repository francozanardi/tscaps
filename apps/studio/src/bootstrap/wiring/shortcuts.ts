import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { SHORTCUT_COMMANDS } from '@core/shortcuts/domain/ShortcutCommands';
import { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import { KeymapResolver } from '@core/shortcuts/services/KeymapResolver';
import { ShortcutConflictFinder } from '@core/shortcuts/services/ShortcutConflictFinder';
import { KeymapOverridesEditor } from '@core/shortcuts/services/KeymapOverridesEditor';
import { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import { LocalStorageKeymapOverridesRepository } from '@core/shortcuts/infrastructure/repositories/LocalStorageKeymapOverridesRepository';
import { LoadKeymapAction } from '@core/shortcuts/actions/LoadKeymapAction';
import { SaveKeymapOverridesAction } from '@core/shortcuts/actions/SaveKeymapOverridesAction';
import { AssignShortcutChordAction } from '@core/shortcuts/actions/AssignShortcutChordAction';
import { RemoveShortcutChordAction } from '@core/shortcuts/actions/RemoveShortcutChordAction';
import { ResetShortcutAction } from '@core/shortcuts/actions/ResetShortcutAction';
import { ResetAllShortcutsAction } from '@core/shortcuts/actions/ResetAllShortcutsAction';

export interface ShortcutsDependencies {
  readonly localStorageClient: LocalStorageClient;
}

export type ShortcutsModule = ReturnType<typeof bootShortcuts>;

/**
 * Boots the keyboard shortcuts feature: the catalog of commands, the
 * keymap in force, and the actions that change and keep the user's
 * choices. The same on every surface — the keymap lives in the browser.
 */
export function bootShortcuts(deps: ShortcutsDependencies) {
  const catalog = new ShortcutCatalog(SHORTCUT_COMMANDS);
  const resolver = new KeymapResolver(catalog);
  const conflictFinder = new ShortcutConflictFinder(catalog);
  const overridesEditor = new KeymapOverridesEditor(catalog, conflictFinder);
  const store = new KeymapStore();
  const repository = new LocalStorageKeymapOverridesRepository(deps.localStorageClient);
  const save = new SaveKeymapOverridesAction(repository, resolver, store);
  return {
    store,
    services: {
      catalog,
      conflictFinder,
    },
    actions: {
      load: new LoadKeymapAction(repository, resolver, store),
      assign: new AssignShortcutChordAction(store, overridesEditor, save),
      remove: new RemoveShortcutChordAction(store, overridesEditor, save),
      reset: new ResetShortcutAction(store, overridesEditor, save),
      resetAll: new ResetAllShortcutsAction(save),
    },
  };
}
