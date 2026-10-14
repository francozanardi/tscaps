import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { KeyChord } from '@core/shortcuts/domain/KeyChord';
import { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import type { KeymapOverridesRepository } from '@core/shortcuts/domain/KeymapOverridesRepository';

const KEY = 'keymap';

interface StoredKeymap {
  readonly bindings: Record<string, string[]>;
}

/**
 * localStorage-backed implementation: the keymap belongs to the browser,
 * not to a project. What it cannot read is dropped piece by piece — a
 * chord that does not parse loses that chord, a command whose entry is
 * not a list loses its entry — so one bad value never costs the rest.
 */
export class LocalStorageKeymapOverridesRepository implements KeymapOverridesRepository {

  constructor(private readonly storage: LocalStorageClient) {}

  load(): KeymapOverrides {
    const stored = this.storage.get<unknown>(KEY);
    if (!this.isRecord(stored) || !this.isRecord(stored.bindings)) return KeymapOverrides.empty();
    const entries: Array<readonly [string, KeyChord[]]> = [];
    for (const [commandId, serializedChords] of Object.entries(stored.bindings)) {
      if (!Array.isArray(serializedChords)) continue;
      entries.push([commandId, this.parseChords(serializedChords)]);
    }
    return KeymapOverrides.fromEntries(entries);
  }

  save(overrides: KeymapOverrides): void {
    const bindings: Record<string, string[]> = {};
    for (const [commandId, chords] of overrides.entries()) {
      bindings[commandId] = chords.map((chord) => chord.serialize());
    }
    const stored: StoredKeymap = { bindings };
    this.storage.set(KEY, stored);
  }

  private parseChords(serializedChords: unknown[]): KeyChord[] {
    const chords: KeyChord[] = [];
    for (const serialized of serializedChords) {
      if (typeof serialized !== 'string') continue;
      const chord = KeyChord.parse(serialized);
      if (chord) chords.push(chord);
    }
    return chords;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
