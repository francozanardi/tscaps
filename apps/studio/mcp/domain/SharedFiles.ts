/** Files on disk the page may read, each under an opaque id: the page is handed a URL path, never a file's path. */
export interface SharedFiles {
  /** Shares `filePath` and answers the URL path the page reads it from. */
  share(filePath: string): string;
}
