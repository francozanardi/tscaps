/**
 * Where a project's video bytes were found: held in memory for this
 * session, kept on this device, or fetched from the server.
 */
export type VideoBlobSource = 'memory' | 'device' | 'server';

/**
 * Why a lookup came back without bytes.
 *
 * - `absent`: nothing was held for the project — never stored here,
 *   or evicted to make room.
 * - `stored-bytes-gone`: the stored record is there, but the file the
 *   browser keeps its bytes in was removed underneath it.
 * - `held-file-gone`: the file chosen for the project is no longer
 *   readable, and nothing durable was kept in its place.
 * - `remote-provider-unresponsive`: the remote copy could not be read
 *   because the storage backend rejected the fetch with a server error
 *   (5xx). The bytes are still there on the server; the request will
 *   likely succeed on retry once the backend recovers. Only produced
 *   by repositories that read from a remote backend.
 */
export type VideoBlobMissReason =
  | 'absent'
  | 'stored-bytes-gone'
  | 'held-file-gone'
  | 'remote-provider-absent'
  | 'remote-provider-unresponsive';

export interface FoundVideoBlob {
  readonly outcome: 'found';
  readonly blob: Blob;
  readonly source: VideoBlobSource;
}

export interface MissingVideoBlob {
  readonly outcome: 'missing';
  readonly reason: VideoBlobMissReason;
}

/**
 * The result of asking for a project's video bytes. A `found` result
 * carries bytes a read went through on, and which copy answered; a
 * `missing` one says why there are none, which is the difference
 * between a copy that was never here and one the browser took away.
 */
export type VideoBlobLookup = FoundVideoBlob | MissingVideoBlob;
