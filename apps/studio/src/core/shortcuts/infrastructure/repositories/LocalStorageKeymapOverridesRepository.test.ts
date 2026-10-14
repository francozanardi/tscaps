import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { KeyChord } from '@core/shortcuts/domain/KeyChord';
import { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import { LocalStorageKeymapOverridesRepository } from '@core/shortcuts/infrastructure/repositories/LocalStorageKeymapOverridesRepository';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function repository(): LocalStorageKeymapOverridesRepository {
  return new LocalStorageKeymapOverridesRepository(new LocalStorageClient('test'));
}

describe('the stored keymap', () => {
  it('reads back what was saved, unbound commands included', () => {
    const saved = KeymapOverrides.empty()
      .with('edit.redo', [new KeyChord('z', true, true, true), new KeyChord('plus', true)])
      .with('playback.toggle', []);

    repository().save(saved);
    const loaded = repository().load();

    expect(loaded.chordsFor('edit.redo')).toEqual([new KeyChord('z', true, true, true), new KeyChord('plus', true)]);
    expect(loaded.chordsFor('playback.toggle')).toEqual([]);
    expect(loaded.chordsFor('edit.undo')).toBeNull();
  });

  it('keeps a choice for a command this build does not have', () => {
    repository().save(KeymapOverrides.empty().with('some.future.command', [new KeyChord('j')]));

    expect(repository().load().chordsFor('some.future.command')).toEqual([new KeyChord('j')]);
  });

  it('drops what it cannot read and keeps the rest', () => {
    storage.setItem('test:keymap', JSON.stringify({
      bindings: {
        'edit.undo': ['mod+z', 'hyper+z', '', 42],
        'edit.redo': 'mod+y',
      },
    }));

    const loaded = repository().load();

    expect(loaded.chordsFor('edit.undo')).toEqual([new KeyChord('z', true)]);
    expect(loaded.chordsFor('edit.redo')).toBeNull();
  });

  it('reads a corrupted value as no choices at all', () => {
    storage.setItem('test:keymap', '{not json');

    expect(repository().load().isEmpty()).toBe(true);
  });
});
