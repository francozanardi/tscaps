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
import { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';
import { ShortcutRecordingController } from '@presentation/shortcuts/controllers/ShortcutRecordingController';

class InMemoryKeymapOverridesRepository implements KeymapOverridesRepository {
  private stored = KeymapOverrides.empty();

  load(): KeymapOverrides {
    return this.stored;
  }

  save(overrides: KeymapOverrides): void {
    this.stored = overrides;
  }
}

function setUp() {
  const repository = new InMemoryKeymapOverridesRepository();
  const catalog = new ShortcutCatalog(SHORTCUT_COMMANDS);
  const resolver = new KeymapResolver(catalog);
  const conflictFinder = new ShortcutConflictFinder(catalog);
  const store = new KeymapStore();
  new LoadKeymapAction(repository, resolver, store).execute();
  const assign = new AssignShortcutChordAction(
    store,
    new KeymapOverridesEditor(catalog, conflictFinder),
    new SaveKeymapOverridesAction(repository, resolver, store),
  );
  const recorder = new ShortcutRecordingController(store, conflictFinder, assign, new KeyChordReader());
  return { store, recorder };
}

function keydown(init: Record<string, unknown>): KeyboardEvent {
  return { code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init } as unknown as KeyboardEvent;
}

describe('recording a shortcut', () => {
  it('binds a chord nobody else answers to at once', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.pause', null);

    recorder.capture(keydown({ key: 'p', code: 'KeyP', altKey: true }));

    expect(store.keymap.chordsFor('playback.pause')).toEqual([new KeyChord('p', false, false, true)]);
    expect(recorder.recording.kind).toBe('idle');
  });

  it('waits past a lone modifier for the key it modifies', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.pause', null);

    recorder.capture(keydown({ key: 'Control', ctrlKey: true }));
    recorder.capture(keydown({ key: 'j', code: 'KeyJ', ctrlKey: true }));

    expect(store.keymap.chordsFor('playback.pause')).toEqual([new KeyChord('j', true)]);
  });

  it('asks before taking a chord another command answers to, and takes it when told to', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.pause', null);

    recorder.capture(keydown({ key: 'f', code: 'KeyF', ctrlKey: true }));
    const asked = recorder.recording;
    recorder.confirm();

    expect(asked.kind === 'confirming' && asked.conflicts.map((command) => command.id)).toEqual(['editor.search']);
    expect(store.keymap.commandsBoundTo(new KeyChord('f', true))).toEqual(['playback.pause']);
  });

  it('changes nothing when the user backs out of taking a chord', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.pause', null);

    recorder.capture(keydown({ key: 'f', code: 'KeyF', ctrlKey: true }));
    recorder.cancel();

    expect(store.keymap.commandsBoundTo(new KeyChord('f', true))).toEqual(['editor.search']);
    expect(recorder.recording.kind).toBe('idle');
  });

  it('gives up on Escape', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.pause', null);

    recorder.capture(keydown({ key: 'Escape', code: 'Escape' }));

    expect(recorder.recording.kind).toBe('idle');
    expect(store.keymap.chordsFor('playback.pause')).toEqual([]);
  });

  it('refuses a chord the browser keeps for itself and goes on listening', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.pause', null);

    recorder.capture(keydown({ key: 'w', code: 'KeyW', metaKey: true }));

    expect(recorder.recording).toMatchObject({ kind: 'listening', refusedChord: new KeyChord('w', true) });
    expect(store.keymap.chordsFor('playback.pause')).toEqual([]);
  });

  it('leaves a command alone when pressed one of its own chords', () => {
    const { store, recorder } = setUp();
    recorder.startRecording('playback.toggle', null);

    recorder.capture(keydown({ key: ' ', code: 'Space' }));

    expect(store.keymap.chordsFor('playback.toggle')).toEqual([new KeyChord('space'), new KeyChord('k', false, false, true)]);
    expect(recorder.recording.kind).toBe('idle');
  });

  it('takes no keystroke while nothing is being recorded', () => {
    const { recorder } = setUp();

    expect(recorder.capture(keydown({ key: 'a', code: 'KeyA' }))).toBe(false);
  });
});
