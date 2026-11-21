import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** A folder of the session's own for files nobody named, such as the pictures of frames. Made on first use. */
export class ScratchFolder {
  private folder: string | null = null;

  /** An absolute path in the folder for a file named `name`. */
  pathFor(name: string): string {
    this.folder ??= mkdtempSync(path.join(tmpdir(), 'tscaps-mcp-'));
    return path.join(this.folder, name);
  }
}
