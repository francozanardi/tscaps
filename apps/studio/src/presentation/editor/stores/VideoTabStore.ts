export type VideoTabId = 'shots' | 'media' | 'audio' | 'aspect-ratio' | 'color';

/**
 * Observable selection of the active tab inside the Video sidebar
 * panel. A `'change'` event fires on every transition; identical
 * writes are suppressed so subscribers only see real edges.
 */
export class VideoTabStore extends EventTarget {
  private _activeTabId: VideoTabId = 'shots';

  get activeTabId(): VideoTabId {
    return this._activeTabId;
  }

  setActiveTab(id: VideoTabId): void {
    if (this._activeTabId === id) return;
    this._activeTabId = id;
    this.dispatchEvent(new Event('change'));
  }
}
