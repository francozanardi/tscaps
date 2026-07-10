import type { UserBlob } from '@core/user-blobs/domain/UserBlob';

/**
 * Observable list of the user's blobs. Reads through `snapshot()`;
 * writes through `setBlobs`. Mirrors the `UserFontsStore`
 * `EventTarget` pattern so React subscribers can attach via
 * `useSyncExternalStore`.
 *
 * Holds no IO — persistence lives in `UserBlobRepository`, the
 * object-URL cache in `UserBlobUrlResolver`, and the orchestration
 * in the upload/delete actions. The resolver pushes every change
 * here so the UI list stays in lockstep with what is actually
 * resolvable.
 */
export class UserBlobsStore extends EventTarget {
  private _blobs: readonly UserBlob[];
  private readonly _changeEvent = new Event('change');

  constructor(initial: readonly UserBlob[]) {
    super();
    this._blobs = initial;
  }

  snapshot(): readonly UserBlob[] {
    return this._blobs;
  }

  setBlobs(blobs: readonly UserBlob[]): void {
    this._blobs = blobs;
    this.dispatchEvent(this._changeEvent);
  }
}
