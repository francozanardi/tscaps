/** Pure-state shape returned by `snapshot()`. */
export interface TemplateLibrarySnapshot {
  favorites: ReadonlySet<string>;
  recent: readonly string[];
}

/**
 * UI-facing projection: the store's snapshot plus the action callbacks
 * that subscribed views invoke. Composition root wires this — the store
 * does not produce it.
 */
export interface TemplateLibraryView extends TemplateLibrarySnapshot {
  toggleFavorite: (templateId: string) => void;
}

/**
 * Observable state container for the templates feature: starred templates
 * and recently-applied ones. Reads through `snapshot()`; writes through
 * `setFavorites` / `setRecent`. Holds no IO — persistence and the
 * decision logic live in the templates actions.
 */
export class TemplateLibraryStore extends EventTarget {
  private _favorites: ReadonlySet<string>;
  private _recent: readonly string[];
  private readonly _changeEvent = new Event('change');

  constructor(initial: TemplateLibrarySnapshot) {
    super();
    this._favorites = initial.favorites;
    this._recent = initial.recent;
  }

  snapshot(): TemplateLibrarySnapshot {
    return { favorites: this._favorites, recent: this._recent };
  }

  setFavorites(favorites: ReadonlySet<string>): void {
    this._favorites = favorites;
    this.dispatchEvent(this._changeEvent);
  }

  setRecent(recent: readonly string[]): void {
    this._recent = recent;
    this.dispatchEvent(this._changeEvent);
  }
}
