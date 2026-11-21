/** What serves the built editor and the files shared with it to the page, behind the session's token. */
export interface EditorServer {
  /** The URL that opens the editor route `editorRoute` (relative to the base path) for this session. */
  editorUrl(editorRoute: string): string;
  /** The URL the page reads a shared file from, given the path `SharedFiles.share` answered. */
  mediaUrl(mediaPath: string): string;
  /** Stops serving, and drops the page's channel. */
  stop(): void;
}
