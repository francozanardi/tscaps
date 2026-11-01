import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Re-derives the document each time a font face finishes loading, so
 * lines measured while a face was missing are measured again with it.
 *
 * A caption's family compiles to a name with no face behind it, so a
 * derivation that runs before that face is loaded measures the browser's
 * default font instead. That happens whenever the family is new — a
 * template just picked — and whenever its faces are declared again, which
 * leaves them unloaded. The load that repairs it starts later, when
 * something paints the family, so it is answered here rather than
 * predicted at derivation time.
 *
 * Arrival is read off each face's own `loaded` promise, not the set's
 * `loadingdone` event: Safari loads a face declared in CSS without
 * firing that event at all. Faces are declared by stylesheets in
 * `declarations`, and a new or rewritten stylesheet hands the set new
 * face objects at once, so every change there is when the set is read
 * for faces not yet watched.
 *
 * A loading cycle derives once, on the first frame after the last face it
 * started has settled: one that settles while another watched face is
 * still loading waits for that face. Each face's own status is read for this, never
 * the set's, which can stay on `loading` after every face has settled.
 * A cycle in which every face failed derives nothing, and a face that is
 * never asked for never settles, so the re-derivations end when the
 * declarations stop changing.
 */
export class FontArrivalAutomation {

  private readonly watched = new WeakSet<FontFace>();
  private observer: MutationObserver | null = null;
  private arrivedSinceRefresh = false;
  private settleCheckQueued = false;

  constructor(
    private readonly fonts: FontFaceSet,
    private readonly declarations: Node,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  start(): void {
    if (this.observer !== null) return;
    this.observer = new MutationObserver(this.watchDeclaredFaces);
    this.observer.observe(this.declarations, { childList: true, subtree: true, characterData: true });
    this.watchDeclaredFaces();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private readonly watchDeclaredFaces = (): void => {
    for (const face of this.fonts) {
      if (face.status === 'loaded' || this.watched.has(face)) continue;
      this.watched.add(face);
      face.loaded.then(this.onFaceArrived, this.onFaceSettled);
    }
  };

  private readonly onFaceArrived = (): void => {
    this.arrivedSinceRefresh = true;
    this.onFaceSettled();
  };

  // Checked on the next frame rather than at once: by then the paint that
  // follows a derivation has asked for the faces it needs, so a cycle still
  // under way reads as loading instead of deriving between its faces. A
  // hidden page runs no frames and derives when it is shown again.
  private readonly onFaceSettled = (): void => {
    if (this.settleCheckQueued) return;
    this.settleCheckQueued = true;
    requestAnimationFrame(this.refreshOnceCycleSettles);
  };

  private readonly refreshOnceCycleSettles = (): void => {
    this.settleCheckQueued = false;
    if (this.observer === null || !this.arrivedSinceRefresh || this.isWatchedFaceLoading()) return;
    this.arrivedSinceRefresh = false;
    this.refresh.execute();
  };

  private isWatchedFaceLoading(): boolean {
    for (const face of this.fonts) {
      if (face.status === 'loading' && this.watched.has(face)) return true;
    }
    return false;
  }
}
