/**
 * The video files that reached the editor through a landing's handoff.
 *
 * Such a file reads its bytes lazily from an entry the handoff keeps
 * for a limited time, and every studio page load removes the entries
 * older than that, whether a tab still reads them or not. Knowing
 * which files those are is what lets the editor stop reading one once
 * it keeps a copy of its own.
 *
 * Holds the files weakly: a file the editor let go of is forgotten.
 */
export class HandedOffVideoFiles {
  private readonly files = new WeakSet<File>();

  remember(file: File): void {
    this.files.add(file);
  }

  includes(file: File): boolean {
    return this.files.has(file);
  }
}
