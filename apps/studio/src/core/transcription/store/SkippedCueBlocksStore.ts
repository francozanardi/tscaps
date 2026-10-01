/**
 * Collects the blocks a subtitle file reader could not use, so the
 * run can end by saying what did not make it into the video.
 *
 * The file may not have been written by whoever loads it. Dropping
 * the odd unreadable block is what keeps the rest of the file usable,
 * but a drop nobody mentions is indistinguishable from a caption that
 * was never in the file — and the reader is the only one who can
 * tell those apart.
 *
 * Emits `'change'` on every record and on every clear.
 */
export class SkippedCueBlocksStore extends EventTarget {
  private readonly blocks: string[] = [];

  record(block: string): void {
    this.blocks.push(block);
    this.dispatchEvent(new Event('change'));
  }

  /** Forgets every block, for a new file. */
  clear(): void {
    if (this.blocks.length === 0) return;
    this.blocks.length = 0;
    this.dispatchEvent(new Event('change'));
  }

  snapshot(): readonly string[] {
    return [...this.blocks];
  }
}
