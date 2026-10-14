import { describe, expect, it } from 'vitest';
import { KeyChord } from '@core/shortcuts/domain/KeyChord';
import { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import type { KeymapOverridesRepository } from '@core/shortcuts/domain/KeymapOverridesRepository';
import { SHORTCUT_COMMANDS } from '@core/shortcuts/domain/ShortcutCommands';
import { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import { KeymapResolver } from '@core/shortcuts/services/KeymapResolver';
import { ShortcutConflictFinder } from '@core/shortcuts/services/ShortcutConflictFinder';
import { KeymapOverridesEditor } from '@core/shortcuts/services/KeymapOverridesEditor';
import { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import { LoadKeymapAction } from '@core/shortcuts/actions/LoadKeymapAction';
import { SaveKeymapOverridesAction } from '@core/shortcuts/actions/SaveKeymapOverridesAction';
import { AssignShortcutChordAction } from '@core/shortcuts/actions/AssignShortcutChordAction';
import { RemoveShortcutChordAction } from '@core/shortcuts/actions/RemoveShortcutChordAction';
import { ResetShortcutAction } from '@core/shortcuts/actions/ResetShortcutAction';
import { ResetAllShortcutsAction } from '@core/shortcuts/actions/ResetAllShortcutsAction';

class InMemoryKeymapOverridesRepository implements KeymapOverridesRepository {
  stored = KeymapOverrides.empty();

  load(): KeymapOverrides {
    return this.stored;
  }

  save(overrides: KeymapOverrides): void {
    this.stored = overrides;
  }
}

function bootShortcuts(repository: KeymapOverridesRepository = new InMemoryKeymapOverridesRepository()) {
  const catalog = new ShortcutCatalog(SHORTCUT_COMMANDS);
  const resolver = new KeymapResolver(catalog);
  const editor = new KeymapOverridesEditor(catalog, new ShortcutConflictFinder(catalog));
  const store = new KeymapStore();
  const save = new SaveKeymapOverridesAction(repository, resolver, store);
  new LoadKeymapAction(repository, resolver, store).execute();
  return {
    store,
    assign: new AssignShortcutChordAction(store, editor, save),
    remove: new RemoveShortcutChordAction(store, editor, save),
    reset: new ResetShortcutAction(store, editor, save),
    resetAll: new ResetAllShortcutsAction(save),
  };
}

const CTRL_F = new KeyChord('f', true);
const SPACE = new KeyChord('space');
const DELETE = new KeyChord('delete');
const ALT_K = new KeyChord('k', false, false, true);

describe('the keymap', () => {
  it('answers to the defaults until the user changes something', () => {
    const shortcuts = bootShortcuts();

    expect(shortcuts.store.keymap.chordsFor('editor.search')).toEqual([CTRL_F]);
    expect(shortcuts.store.keymap.commandsBoundTo(SPACE)).toEqual(['playback.toggle']);
  });

  it('takes a chord away from the command that had it when another command is given it', () => {
    const shortcuts = bootShortcuts();

    shortcuts.assign.execute({ commandId: 'playback.pause', chord: CTRL_F, replacing: null });

    expect(shortcuts.store.keymap.commandsBoundTo(CTRL_F)).toEqual(['playback.pause']);
    expect(shortcuts.store.keymap.chordsFor('editor.search')).toEqual([]);
  });

  it('lets a chord mean one thing in each editing mode', () => {
    const shortcuts = bootShortcuts();

    shortcuts.assign.execute({ commandId: 'transcript.joinNext', chord: DELETE, replacing: null });

    expect(shortcuts.store.keymap.commandsBoundTo(DELETE).sort()).toEqual(['timeline.cut', 'transcript.joinNext']);
  });

  it('puts a replacement where the chord it replaces was', () => {
    const shortcuts = bootShortcuts();
    const ctrlShiftZ = new KeyChord('z', true, true);
    const ctrlAltZ = new KeyChord('z', true, false, true);

    shortcuts.assign.execute({ commandId: 'edit.redo', chord: ctrlAltZ, replacing: ctrlShiftZ });

    expect(shortcuts.store.keymap.chordsFor('edit.redo')).toEqual([ctrlAltZ, new KeyChord('y', true)]);
  });

  it('keeps the choices for the next visit', () => {
    const repository = new InMemoryKeymapOverridesRepository();
    bootShortcuts(repository).remove.execute({ commandId: 'playback.toggle', chord: ALT_K });

    const nextVisit = bootShortcuts(repository);

    expect(nextVisit.store.keymap.chordsFor('playback.toggle')).toEqual([SPACE]);
  });

  it('stores nothing for a command whose chords are back to its defaults', () => {
    const repository = new InMemoryKeymapOverridesRepository();
    const shortcuts = bootShortcuts(repository);

    shortcuts.remove.execute({ commandId: 'playback.toggle', chord: ALT_K });
    shortcuts.assign.execute({ commandId: 'playback.toggle', chord: ALT_K, replacing: null });

    expect(repository.stored.isEmpty()).toBe(true);
  });

  it('gives one command its defaults back without touching the others', () => {
    const shortcuts = bootShortcuts();
    shortcuts.remove.execute({ commandId: 'playback.toggle', chord: SPACE });
    shortcuts.remove.execute({ commandId: 'edit.undo', chord: new KeyChord('z', true) });

    shortcuts.reset.execute('playback.toggle');

    expect(shortcuts.store.keymap.chordsFor('playback.toggle')).toEqual([SPACE, ALT_K]);
    expect(shortcuts.store.keymap.chordsFor('edit.undo')).toEqual([]);
  });

  it('gives every command its defaults back at once', () => {
    const shortcuts = bootShortcuts();
    shortcuts.assign.execute({ commandId: 'playback.pause', chord: CTRL_F, replacing: null });

    shortcuts.resetAll.execute();

    expect(shortcuts.store.keymap.chordsFor('editor.search')).toEqual([CTRL_F]);
    expect(shortcuts.store.keymap.chordsFor('playback.pause')).toEqual([]);
    expect(shortcuts.store.overrides.isEmpty()).toBe(true);
  });
});
