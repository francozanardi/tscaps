/** Files on disk the page may write to, each under an opaque id it is handed instead of a path. */
export interface FileReservations {
  /** Opens `path` to the page under a fresh id. */
  reserve(path: string): string;
  /** Closes the file reserved under `id` and answers how many bytes were written to it. */
  release(id: string): Promise<number>;
}
