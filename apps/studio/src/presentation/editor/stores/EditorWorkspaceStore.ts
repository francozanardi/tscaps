export type EditorModeId = 'captions' | 'video' | 'timeline';

/** A panel's ask that the inspector open on one of its pages, and the part of it to show, if any. */
export interface InspectorPageRequest {
  readonly page: string;
  /** The key the part to scroll to and light is registered under on that page; null for the page as it opens. */
  readonly spotlight: string | null;
}

/** A panel's ask that the Video mode open the transition into one shot, and the part of it to show, if any. */
export interface ShotTransitionRequest {
  readonly shotId: string;
  /** The key the part to scroll to and light is registered under; null for the transition as it opens. */
  readonly spotlight: string | null;
}

/**
 * What the editor's right pane is showing: which mode is open, and
 * whether the element inspector stands in front of it.
 *
 * The inspector is not a mode. A mode is always there to be opened,
 * while the inspector answers for whatever is picked in the preview —
 * nothing, most of the time. It opens on request and stands over the
 * mode until it is closed, so it costs nothing while there is nothing
 * to say.
 *
 * A `'change'` event fires on every transition.
 */
export class EditorWorkspaceStore extends EventTarget {
  private _activeModeId: EditorModeId = 'captions';
  private _isInspectorOpen = false;
  private _inspectorPageRequest: InspectorPageRequest | null = null;
  private _shotTransitionRequest: ShotTransitionRequest | null = null;

  get activeModeId(): EditorModeId {
    return this._activeModeId;
  }

  /**
   * Whether the inspector was asked for. It stays asked-for across
   * picks: someone who opened it once is working element by element,
   * and making them reopen it on every pick would be the whole cost of
   * the surface, paid again per element.
   */
  get isInspectorOpen(): boolean {
    return this._isInspectorOpen;
  }

  /**
   * The inspector page a panel last asked it to open on (a shot's
   * *Sound*, say), or null where none did. Each request is an object of
   * its own, so asking for the same page twice is two requests.
   */
  get inspectorPageRequest(): InspectorPageRequest | null {
    return this._inspectorPageRequest;
  }

  /**
   * Asks the inspector to show its page `page`, where the element it
   * opens on has one, with the part registered there under `spotlight`
   * scrolled into view and lit.
   */
  requestInspectorPage(page: string, spotlight: string | null = null): void {
    this._inspectorPageRequest = { page, spotlight };
    this.dispatchEvent(new Event('change'));
  }

  /** The transition a panel last asked the Video mode to open, or null where none is waiting. */
  get shotTransitionRequest(): ShotTransitionRequest | null {
    return this._shotTransitionRequest;
  }

  /**
   * Opens the Video mode and asks it to open the transition into the shot
   * `shotId`, with the part registered there under `spotlight` shown.
   */
  requestShotTransition(shotId: string, spotlight: string | null = null): void {
    this._shotTransitionRequest = { shotId, spotlight };
    this._activeModeId = 'video';
    this.dispatchEvent(new Event('change'));
  }

  /** Lets go of `request` once the transition it asked for is open. */
  settleShotTransitionRequest(request: ShotTransitionRequest): void {
    if (this._shotTransitionRequest !== request) return;
    this._shotTransitionRequest = null;
    this.dispatchEvent(new Event('change'));
  }

  /** Lets go of `request` once the inspector has opened on its page, so the next element it opens on is not sent there too. */
  settleInspectorPageRequest(request: InspectorPageRequest): void {
    if (this._inspectorPageRequest !== request) return;
    this._inspectorPageRequest = null;
    this.dispatchEvent(new Event('change'));
  }

  setActiveMode(id: EditorModeId): void {
    if (this._activeModeId === id) return;
    this._activeModeId = id;
    this.dispatchEvent(new Event('change'));
  }

  setInspectorOpen(open: boolean): void {
    if (this._isInspectorOpen === open) return;
    this._isInspectorOpen = open;
    this.dispatchEvent(new Event('change'));
  }
}
