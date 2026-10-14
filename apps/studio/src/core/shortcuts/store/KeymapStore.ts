import { Keymap } from '@core/shortcuts/domain/Keymap';
import { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';

/**
 * The keymap in force and the user's choices it was built from. Empty
 * until the stored choices are loaded, so nothing fires before then.
 * A `'change'` event fires on every write.
 */
export class KeymapStore extends EventTarget {

  private _keymap = new Keymap(new Map());
  private _overrides = KeymapOverrides.empty();

  get keymap(): Keymap {
    return this._keymap;
  }

  get overrides(): KeymapOverrides {
    return this._overrides;
  }

  set(keymap: Keymap, overrides: KeymapOverrides): void {
    this._keymap = keymap;
    this._overrides = overrides;
    this.dispatchEvent(new Event('change'));
  }
}
