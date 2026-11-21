import type { GifFile, GifFrameControl, GifFrameEntry } from '@modules/video/animation/GifFile';

const GIF_SIGNATURE = 'GIF';
const LOGICAL_SCREEN_END = 13;
const EXTENSION_INTRODUCER = 0x21;
const IMAGE_SEPARATOR = 0x2c;
const GRAPHIC_CONTROL_LABEL = 0xf9;
const APPLICATION_LABEL = 0xff;
const LOOPING_APPLICATIONS = ['NETSCAPE2.0', 'ANIMEXTS1.0'];
const LOOP_SUB_BLOCK_ID = 1;
const HAS_COLOR_TABLE = 0x80;
const INTERLACED = 0x40;
const HAS_TRANSPARENCY = 0x01;

/**
 * Reads the block structure of a GIF (87a or 89a) in one walk, without
 * decompressing a pixel: the canvas, the global colour table, the
 * NETSCAPE2.0 (or ANIMEXTS1.0) loop count, and every frame's control
 * fields and where its compressed data starts.
 *
 * Reading is lenient, the way browsers read GIFs: a file cut short
 * answers the frames whose descriptor was read whole; unknown
 * extensions are skipped; a byte no GIF holds where a block should
 * start ends the walk. Disposal method 4, which some encoders write for
 * 3, is read as `restore`; any other unknown method as `keep`.
 *
 * The answer holds the bytes it was read from, which its frames point
 * into; nothing is copied.
 */
export class GifFileReader {
  /** The structure of `bytes`, or null when they are not a GIF. */
  read(bytes: Uint8Array): GifFile | null {
    if (bytes.length < LOGICAL_SCREEN_END || this.ascii(bytes, 0, GIF_SIGNATURE.length) !== GIF_SIGNATURE) return null;
    const globalTableBytes = this.colorTableBytes(bytes[10]!);
    const frames: GifFrameEntry[] = [];
    let loopCount: number | null = null;
    let control: GifFrameControl | null = null;
    let offset = LOGICAL_SCREEN_END + globalTableBytes;
    while (offset < bytes.length) {
      const introducer = bytes[offset]!;
      if (introducer === EXTENSION_INTRODUCER) {
        const label = bytes[offset + 1];
        if (label === GRAPHIC_CONTROL_LABEL && bytes[offset + 2] === 4 && offset + 5 < bytes.length) {
          control = this.controlAt(bytes, offset + 3);
        }
        if (label === APPLICATION_LABEL) loopCount = this.loopCountAt(bytes, offset + 2) ?? loopCount;
        offset = this.skipSubBlocks(bytes, offset + 2);
      } else if (introducer === IMAGE_SEPARATOR && offset + 10 <= bytes.length) {
        const frame = this.frameAt(bytes, offset, control);
        frames.push(frame);
        control = null;
        offset = this.skipSubBlocks(bytes, frame.dataOffset);
      } else {
        // The trailer, a cut-off descriptor, or bytes no GIF holds: nothing further is a frame.
        break;
      }
    }
    return {
      bytes,
      ...this.canvasSizeOf(bytes, frames[0]),
      globalColorTable: globalTableBytes > 0 ? bytes.subarray(LOGICAL_SCREEN_END, LOGICAL_SCREEN_END + globalTableBytes) : null,
      loopCount,
      frames,
    };
  }

  /** The logical screen's size, or the first frame's extent where the screen states none. */
  private canvasSizeOf(bytes: Uint8Array, first: GifFrameEntry | undefined): { width: number; height: number } {
    const width = bytes[6]! | (bytes[7]! << 8);
    const height = bytes[8]! | (bytes[9]! << 8);
    if (width > 0 && height > 0) return { width, height };
    return first ? { width: first.left + first.width, height: first.top + first.height } : { width: 0, height: 0 };
  }

  /** The fields of a graphic control block whose packed byte is at `at`. */
  private controlAt(bytes: Uint8Array, at: number): GifFrameControl {
    const packed = bytes[at]!;
    const method = (packed >> 2) & 0x07;
    return {
      delayHundredths: bytes[at + 1]! | (bytes[at + 2]! << 8),
      disposal: method === 2 ? 'clear' : method === 3 || method === 4 ? 'restore' : 'keep',
      transparentIndex: packed & HAS_TRANSPARENCY ? bytes[at + 3] ?? 0 : null,
    };
  }

  /** The frame whose image descriptor starts at `offset`, under the control block read before it. */
  private frameAt(bytes: Uint8Array, offset: number, control: GifFrameControl | null): GifFrameEntry {
    const packed = bytes[offset + 9]!;
    const tableStart = offset + 10;
    const codeSizeAt = tableStart + this.colorTableBytes(packed);
    return {
      delayHundredths: control?.delayHundredths ?? null,
      disposal: control?.disposal ?? 'keep',
      transparentIndex: control?.transparentIndex ?? null,
      left: bytes[offset + 1]! | (bytes[offset + 2]! << 8),
      top: bytes[offset + 3]! | (bytes[offset + 4]! << 8),
      width: bytes[offset + 5]! | (bytes[offset + 6]! << 8),
      height: bytes[offset + 7]! | (bytes[offset + 8]! << 8),
      interlaced: (packed & INTERLACED) !== 0,
      localColorTable: codeSizeAt > tableStart ? bytes.subarray(tableStart, codeSizeAt) : null,
      minCodeSize: codeSizeAt < bytes.length ? bytes[codeSizeAt]! : null,
      dataOffset: codeSizeAt + 1,
    };
  }

  /**
   * The loop count an application extension starting at `offset` (its
   * block size) states, or null when it is not a loop extension.
   */
  private loopCountAt(bytes: Uint8Array, offset: number): number | null {
    if (bytes[offset] !== 11 || !LOOPING_APPLICATIONS.includes(this.ascii(bytes, offset + 1, 11))) return null;
    const dataAt = offset + 12;
    if (bytes[dataAt] !== 3 || bytes[dataAt + 1] !== LOOP_SUB_BLOCK_ID || dataAt + 3 >= bytes.length) return null;
    return bytes[dataAt + 2]! | (bytes[dataAt + 3]! << 8);
  }

  /** The size of the colour table a packed field announces, or 0 when it announces none. */
  private colorTableBytes(packed: number): number {
    return packed & HAS_COLOR_TABLE ? 3 * 2 ** ((packed & 0x07) + 1) : 0;
  }

  /** The offset just past a run of sub-blocks starting at `offset`, its terminator included. */
  private skipSubBlocks(bytes: Uint8Array, offset: number): number {
    let at = offset;
    while (at < bytes.length) {
      const size = bytes[at]!;
      at += 1 + size;
      if (size === 0) return at;
    }
    return bytes.length;
  }

  private ascii(bytes: Uint8Array, start: number, length: number): string {
    return String.fromCharCode(...bytes.subarray(start, start + length));
  }
}
