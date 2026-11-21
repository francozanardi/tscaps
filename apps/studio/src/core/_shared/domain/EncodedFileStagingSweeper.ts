/**
 * Removes the staging files of one kind of encoded output that earlier
 * page loads left behind — runs cut short by a closed tab or a crash —
 * without ever touching a file this page produced: a file handed out
 * from one may still be read, and a browser storing it in an in-memory
 * IndexedDB (a private window) keeps only a reference to that very file.
 */
export interface EncodedFileStagingSweeper {
  /** Sweeps on the first call of the page; every later call resolves at once. Never rejects. */
  sweepLeftovers(): Promise<void>;
}
