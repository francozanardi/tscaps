import { FixtureLzwEncoder } from '@modules/video/animation/FixtureLzwEncoder.fixture';

/** An RGB colour, each channel 0–255. */
export type FixtureColour = readonly [number, number, number];

/** One frame of a fixture GIF. */
export interface FixtureFrame {
  readonly left?: number;
  readonly top?: number;
  readonly width: number;
  readonly height: number;
  /** One colour index per pixel, row by row as shown (interlacing is applied on writing). */
  readonly indices: ReadonlyArray<number>;
  /** Hundredths of a second; 10 when omitted. */
  readonly delay?: number;
  /** The disposal method as the format numbers it, 0–7. */
  readonly disposal?: number;
  readonly transparentIndex?: number;
  readonly interlaced?: boolean;
  readonly localPalette?: ReadonlyArray<FixtureColour>;
  /** The LZW minimum code size; the smallest that holds the palette when omitted. */
  readonly minCodeSize?: number;
  /** What the encoder does once its table is full: start over with a clear code (the default), or keep it as it is. */
  readonly fullTable?: 'clear' | 'keep';
  /** Writes a clear code after every this many codes, on top of any a full table writes. */
  readonly clearEvery?: number;
}

/** A fixture GIF, described the way a test reads it. */
export interface FixtureGif {
  readonly width: number;
  readonly height: number;
  readonly globalPalette?: ReadonlyArray<FixtureColour>;
  /** The NETSCAPE2.0 loop count; none written when omitted. */
  readonly loops?: number;
  readonly frames: ReadonlyArray<FixtureFrame>;
}

/**
 * Writes small GIFs for tests, the way an encoder does: real LZW, with
 * codes growing as the table fills and clear codes where asked, so the
 * decoder under test meets the cases a real file holds.
 */
export class GifFixtureWriter {
  write(gif: FixtureGif): Uint8Array {
    const bytes: number[] = [...this.ascii('GIF89a')];
    bytes.push(...this.uint16(gif.width), ...this.uint16(gif.height));
    if (gif.globalPalette) {
      const table = this.colourTable(gif.globalPalette);
      bytes.push(0x80 | table.sizeBits, 0, 0, ...table.bytes);
    } else {
      bytes.push(0, 0, 0);
    }
    if (gif.loops !== undefined) bytes.push(0x21, 0xff, 11, ...this.ascii('NETSCAPE2.0'), 3, 1, ...this.uint16(gif.loops), 0);
    for (const frame of gif.frames) bytes.push(...this.frame(frame, gif.globalPalette?.length ?? 0));
    bytes.push(0x3b);
    return new Uint8Array(bytes);
  }

  private frame(frame: FixtureFrame, globalColours: number): number[] {
    const transparent = frame.transparentIndex !== undefined;
    const local = frame.localPalette ? this.colourTable(frame.localPalette) : null;
    const colours = frame.localPalette?.length ?? globalColours;
    const minCodeSize = frame.minCodeSize ?? Math.max(2, Math.ceil(Math.log2(Math.max(2, colours))));
    const stored = frame.interlaced ? this.interlaced(frame) : [...frame.indices];
    const data = new FixtureLzwEncoder(minCodeSize, frame.fullTable ?? 'clear', frame.clearEvery ?? Infinity).encode(stored);
    return [
      0x21, 0xf9, 4, ((frame.disposal ?? 0) << 2) | (transparent ? 1 : 0), ...this.uint16(frame.delay ?? 10), frame.transparentIndex ?? 0, 0,
      0x2c, ...this.uint16(frame.left ?? 0), ...this.uint16(frame.top ?? 0), ...this.uint16(frame.width), ...this.uint16(frame.height),
      (frame.interlaced ? 0x40 : 0) | (local ? 0x80 | local.sizeBits : 0), ...(local?.bytes ?? []),
      minCodeSize, ...this.subBlocks(data),
    ];
  }

  /** The rows of `frame` in the order an interlaced GIF stores them. */
  private interlaced(frame: FixtureFrame): number[] {
    const rows: number[] = [];
    for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) {
      for (let row = start; row < frame.height; row += step) rows.push(...frame.indices.slice(row * frame.width, (row + 1) * frame.width));
    }
    return rows;
  }

  private subBlocks(data: number[]): number[] {
    const bytes: number[] = [];
    for (let at = 0; at < data.length; at += 255) {
      const chunk = data.slice(at, at + 255);
      bytes.push(chunk.length, ...chunk);
    }
    bytes.push(0);
    return bytes;
  }

  /** A colour table padded to a power of two of at least two entries, and the size bits that announce it. */
  private colourTable(palette: ReadonlyArray<FixtureColour>): { bytes: number[]; sizeBits: number } {
    const sizeBits = Math.max(0, Math.ceil(Math.log2(Math.max(2, palette.length))) - 1);
    const bytes = palette.flatMap((colour) => [...colour]);
    while (bytes.length < 3 * 2 ** (sizeBits + 1)) bytes.push(0);
    return { bytes, sizeBits };
  }

  private uint16(value: number): [number, number] {
    return [value & 0xff, value >> 8];
  }

  private ascii(text: string): number[] {
    return [...text].map((char) => char.charCodeAt(0));
  }
}
