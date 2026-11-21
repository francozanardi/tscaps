/** Turns the server's TypeScript entry into one script Node runs as it is. */
export interface ScriptBundler {
  /** Writes the bundle of `entry`, and of everything it imports, to `outfile`. */
  bundle(entry: string, outfile: string): Promise<void>;
}
