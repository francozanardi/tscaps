/** Opens the editor's URL in a browser, and closes what it opened when the session ends. */
export interface BrowserLauncher {
  /** Says in a few words where the page opens, for the person reading the agent's answer. */
  readonly description: string;
  open(url: string): Promise<void>;
  /** Closes what `open` started, when it can; a browser the person already had open is left alone. */
  close(): Promise<void>;
}
