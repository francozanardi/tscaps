import { GifSubBlockBitReader } from '@modules/video/animation/GifSubBlockBitReader';

const MAX_CODE_BITS = 12;
const TABLE_SIZE = 1 << MAX_CODE_BITS;
const LARGEST_MIN_CODE_SIZE = MAX_CODE_BITS - 1;

/**
 * Decompresses the image data of one GIF frame — variable-width LZW
 * codes, least significant bit first, spread over length-prefixed
 * sub-blocks — into colour indices.
 *
 * Codes start one bit wider than the minimum code size and grow by a
 * bit each time the table fills the current width, up to twelve bits; a
 * full table is kept (the deferred clear) until a clear code resets it.
 *
 * Decoding is lenient, the way browsers decode GIFs: it stops, keeping
 * what it has written, at the end code, the sub-block terminator, the
 * end of the bytes, or a code that cannot occur at that point.
 *
 * Holds its tables between calls so it allocates nothing per frame; it
 * is not to be called again before a call returns.
 */
export class GifLzwDecoder {
  private readonly prefixes = new Uint16Array(TABLE_SIZE);
  private readonly suffixes = new Uint8Array(TABLE_SIZE);
  /** A string being written out, gathered last index first. */
  private readonly reversed = new Uint8Array(TABLE_SIZE + 1);
  private reversedLength = 0;

  /**
   * Writes the indices compressed in the sub-blocks starting at
   * `dataOffset` of `bytes` into `out`, from its start, and answers how
   * many were written — at most `out.length`. Throws for a minimum code
   * size no GIF can have.
   */
  decode(bytes: Uint8Array, dataOffset: number, minCodeSize: number, out: Uint8Array): number {
    if (!(Number.isInteger(minCodeSize) && minCodeSize >= 1 && minCodeSize <= LARGEST_MIN_CODE_SIZE)) {
      throw new Error(`A GIF frame states an LZW minimum code size of ${minCodeSize}.`);
    }
    const codes = new GifSubBlockBitReader(bytes, dataOffset);
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = endCode + 1;
    let previous = -1;
    let firstOfPrevious = 0;
    let written = 0;
    while (written < out.length) {
      const code = codes.read(codeSize);
      if (code === -1 || code === endCode) return written;
      if (code === clearCode) {
        codeSize = minCodeSize + 1;
        nextCode = endCode + 1;
        previous = -1;
        continue;
      }
      // After a clear, only a single index can come; past it, only a code
      // already in the table or the one about to be added.
      if (previous === -1 ? code > clearCode : code > nextCode) return written;
      const first = this.expand(code, previous, firstOfPrevious, nextCode, endCode);
      written = this.writeOut(out, written);
      if (previous !== -1 && nextCode < TABLE_SIZE) {
        this.prefixes[nextCode] = previous;
        this.suffixes[nextCode] = first;
        nextCode++;
        if (nextCode === 1 << codeSize && codeSize < MAX_CODE_BITS) codeSize++;
      }
      previous = code;
      firstOfPrevious = first;
    }
    return written;
  }

  /**
   * Gathers the string `code` stands for into {@link reversed}, last
   * index first, and answers its first index. A code not in the table
   * yet (`nextCode`) stands for the previous string plus that string's
   * own first index, `firstOfPrevious`.
   */
  private expand(code: number, previous: number, firstOfPrevious: number, nextCode: number, endCode: number): number {
    this.reversedLength = 0;
    let walked = code;
    if (code === nextCode) {
      this.reversed[this.reversedLength++] = firstOfPrevious;
      walked = previous;
    }
    while (walked > endCode) {
      this.reversed[this.reversedLength++] = this.suffixes[walked]!;
      walked = this.prefixes[walked]!;
    }
    this.reversed[this.reversedLength++] = walked;
    return walked;
  }

  /** Writes the gathered string into `out` from `written`, as far as it has room; answers the new count. */
  private writeOut(out: Uint8Array, written: number): number {
    let count = written;
    while (this.reversedLength > 0 && count < out.length) out[count++] = this.reversed[--this.reversedLength]!;
    return count;
  }
}
