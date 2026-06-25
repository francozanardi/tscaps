export type EditorModeId = 'captions' | 'cuts';

/**
 * Observable selection of the editor's top-level mode tab (Captions,
 * Cuts, ...). A `'change'` event fires on every transition.
 */
export class EditorWorkspaceStore extends EventTarget {
  private _activeModeId: EditorModeId = 'captions';

  get activeModeId(): EditorModeId {
    return this._activeModeId;
  }

  setActiveMode(id: EditorModeId): void {
    if (this._activeModeId === id) return;
    this._activeModeId = id;
    this.dispatchEvent(new Event('change'));
  }
}
