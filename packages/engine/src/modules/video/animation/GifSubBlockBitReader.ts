/**
 * Reads codes of a given width, least significant bit first, from a run
 * of length-prefixed GIF sub-blocks, as one stream of bits that skips
 * the length bytes. A cursor over bytes it does not copy.
 */
export class GifSubBlockBitReader {
  private at: number;
  private subBlockEnd: number;
  private bits = 0;
  private bitCount = 0;

  /** `offset` is where the first sub-block's length byte sits in `bytes`. */
  constructor(private readonly bytes: Uint8Array, offset: number) {
    this.at = offset;
    this.subBlockEnd = offset;
  }

  /**
   * The next `width` bits (at most 24) as a number, or -1 once the run
   * ends — at its terminator or at the end of the bytes — before that
   * many are left.
   */
  read(width: number): number {
    while (this.bitCount < width) {
      if (this.at === this.subBlockEnd && !this.enterNextSubBlock()) return -1;
      if (this.at >= this.bytes.length) return -1;
      this.bits |= this.bytes[this.at++]! << this.bitCount;
      this.bitCount += 8;
    }
    const value = this.bits & ((1 << width) - 1);
    this.bits >>>= width;
    this.bitCount -= width;
    return value;
  }

  /** Steps past the next length byte; false at the terminator or the end of the bytes. */
  private enterNextSubBlock(): boolean {
    const size = this.bytes[this.subBlockEnd] ?? 0;
    if (size === 0) return false;
    this.at = this.subBlockEnd + 1;
    this.subBlockEnd = this.at + size;
    return true;
  }
}
