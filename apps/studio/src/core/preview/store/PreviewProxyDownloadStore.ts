/**
 * Snapshot of the preview-proxy fetch an open is waiting on.
 *
 * - `idle`: nothing is coming over the network, either because the
 *   proxy answered from local storage, because the project has none,
 *   or because the fetch is over.
 * - `downloading`: bytes are moving. `progress` carries the received
 *   fraction, or `null` when the transport advertised no total size.
 */
export type PreviewProxyDownloadStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'downloading'; readonly progress: number | null };

const IDLE: PreviewProxyDownloadStatus = { kind: 'idle' };

/**
 * Observable progress of the preview proxy an open is blocked on.
 *
 * Narrower than the original video's store on purpose: this fetch has
 * no terminal state worth publishing. Whoever started it holds the
 * promise that says how it ended, and a proxy that never arrives is
 * not a failure — the open continues on the original bytes.
 *
 * `report` is what a download calls; the status enters `downloading`
 * on the first call, so the state means "bytes are moving" and never
 * has to be armed ahead of a fetch that may not happen.
 */
export class PreviewProxyDownloadStore extends EventTarget {
  private _status: PreviewProxyDownloadStatus = IDLE;

  get status(): PreviewProxyDownloadStatus {
    return this._status;
  }

  report(progress: number | null): void {
    const next = progress === null ? null : this.clamp01(progress);
    if (this._status.kind === 'downloading' && this._status.progress === next) return;
    this.publish({ kind: 'downloading', progress: next });
  }

  /** Returns to `idle`, whatever the fetch settled as. */
  reset(): void {
    if (this._status.kind === 'idle') return;
    this.publish(IDLE);
  }

  private publish(status: PreviewProxyDownloadStatus): void {
    this._status = status;
    this.dispatchEvent(new Event('change'));
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
