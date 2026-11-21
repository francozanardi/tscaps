import { describe, expect, it } from 'vitest';
import { GifFrameDurationReader } from '@modules/video/animation/GifFrameDurationReader';
import { GifFileReader } from '@modules/video/animation/GifFileReader';

/**
 * A GIF's frame durations come from the delays it states, a tenth of a
 * second standing in for one too short to honour, as browsers do.
 */

const reader = new GifFrameDurationReader(new GifFileReader());

interface FixtureFrame {
  /** Hundredths of a second, as the file states it; omitted for a frame with no control block. */
  readonly delay?: number;
  readonly withLocalPalette?: boolean;
}

/**
 * A 1×1 GIF with one frame per entry, pixel data and all, the way an
 * encoder writes one; `loops` writes a NETSCAPE2.0 loop count.
 */
function gif(frames: ReadonlyArray<FixtureFrame>, { withComment = false, loops }: { withComment?: boolean; loops?: number } = {}): Uint8Array {
  const bytes: number[] = [...'GIF89a'].map((char) => char.charCodeAt(0));
  bytes.push(1, 0, 1, 0, 0x80, 0, 0, 0xff, 0, 0, 0, 0, 0xff);
  if (loops !== undefined) {
    bytes.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((char) => char.charCodeAt(0)), 3, 1, loops & 0xff, loops >> 8, 0);
  }
  if (withComment) bytes.push(0x21, 0xfe, 3, 0x61, 0x62, 0x63, 0);
  for (const frame of frames) {
    if (frame.delay !== undefined) bytes.push(0x21, 0xf9, 4, 0, frame.delay & 0xff, frame.delay >> 8, 0, 0);
    bytes.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, frame.withLocalPalette ? 0x80 : 0);
    if (frame.withLocalPalette) bytes.push(0, 0xff, 0, 0, 0, 0);
    bytes.push(2, 2, 0x44, 0x01, 0);
  }
  bytes.push(0x3b);
  return new Uint8Array(bytes);
}

describe('reading the frame durations of a GIF', () => {
  it('reads each frame for the delay it states', () => {
    expect(reader.read(gif([{ delay: 10 }, { delay: 30 }, { delay: 250 }]))?.frameDurationsSec).toEqual([0.1, 0.3, 2.5]);
  });

  it('reads a delay too short to honour, or none at all, as a tenth of a second', () => {
    expect(reader.read(gif([{ delay: 0 }, { delay: 1 }, {}, { delay: 2 }]))?.frameDurationsSec).toEqual([0.1, 0.1, 0.1, 0.02]);
  });

  it('reads past colour tables and other extensions', () => {
    expect(reader.read(gif([{ delay: 5, withLocalPalette: true }, { delay: 7 }], { withComment: true }))?.frameDurationsSec)
      .toEqual([0.05, 0.07]);
  });

  it('answers the frames read up to where a cut-off file ends', () => {
    const whole = gif([{ delay: 10 }, { delay: 20 }]);

    expect(reader.read(whole.subarray(0, whole.length - 3))?.frameDurationsSec).toEqual([0.1, 0.2]);
    expect(reader.read(whole.subarray(0, 40))?.frameDurationsSec).toEqual([0.1]);
  });

  it('plays once with no loop count, for ever with a count of 0, and the first run plus N repeats with N', () => {
    const frames = [{ delay: 10 }, { delay: 10 }];

    expect(reader.read(gif(frames))?.playCount).toBe(1);
    expect(reader.read(gif(frames, { loops: 0 }))?.playCount).toBe(Infinity);
    expect(reader.read(gif(frames, { loops: 2, withComment: true }))).toEqual({ frameDurationsSec: [0.1, 0.1], playCount: 3 });
  });

  it('answers null for bytes that are not a GIF', () => {
    expect(reader.read(new TextEncoder().encode('\x89PNG\r\n\x1a\n0000000000'))).toBeNull();
  });
});
