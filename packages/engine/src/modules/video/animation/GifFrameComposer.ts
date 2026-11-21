import type { GifFile, GifFrameEntry } from '@modules/video/animation/GifFile';
import type { GifLzwDecoder } from '@modules/video/animation/GifLzwDecoder';

const CHANNELS = 4;
const OPAQUE = 255;
// A frame with no colour table of its own and none global is drawn in
// black, as Chromium draws it; the format leaves the colours to the reader.
const BLACK_COLOUR_TABLE = new Uint8Array(256 * 3);
/** The interlace passes: the row each starts at and the step between its rows. */
const INTERLACE_PASSES: ReadonlyArray<readonly [start: number, step: number]> = [[0, 8], [4, 8], [2, 4], [1, 2]];

/** The part of the canvas a frame drew over, kept so it can be put back. */
interface SavedArea {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

/**
 * Composes the frames of a GIF onto its canvas, as RGBA, the way
 * browsers show them: each frame drawn over what the frames before it
 * left, its transparent index drawing nothing, its rows de-interlaced,
 * and the area of the frame before it disposed of first — kept, cleared
 * to transparent, or restored to what it was before that frame drew.
 * A frame reaching past the canvas is cut at its edge; an index past
 * the end of its colour table draws nothing, and a frame with no colour
 * table at all draws in black.
 *
 * Memory is bounded by the canvas, not by the number of frames: it
 * holds the canvas, the area under the last frame where that frame is
 * to be restored, and one frame's worth of indices. Frames are composed
 * forward, one after another, from the last one composed. A frame
 * before that one — a loop starting over, a seek back — is composed
 * again from the nearest restart point at or before it: the first
 * frame, a frame that covers the whole canvas with no transparent
 * index and is not restored afterwards, or a frame following one that covers the whole canvas and is
 * cleared. Those are found from the file's structure alone, and a
 * forward step past one jumps to it rather than composing the frames
 * in between.
 *
 * Not to be called again before a call returns.
 */
export class GifFrameComposer {
  private readonly canvas: Uint8ClampedArray<ArrayBuffer>;
  private readonly restartPoints: readonly number[];
  private composedIndex = -1;
  private disposalDue: GifFrameEntry | null = null;
  private saved: SavedArea | null = null;
  private indices = new Uint8Array(0);

  constructor(
    private readonly file: GifFile,
    private readonly lzw: GifLzwDecoder,
  ) {
    this.canvas = new Uint8ClampedArray(file.width * file.height * CHANNELS);
    this.restartPoints = this.restartPointsOf(file.frames);
  }

  get width(): number {
    return this.file.width;
  }

  get height(): number {
    return this.file.height;
  }

  get frameCount(): number {
    return this.file.frames.length;
  }

  /**
   * The canvas, `width` × `height` RGBA pixels row by row, once every
   * frame up to `frameIndex` has been composed onto it. The array is
   * the composer's own and changes on the next call; a caller keeping a
   * frame copies it.
   *
   * Throws for an index out of range, and for a frame stating an LZW
   * code size no GIF can have; the next call then composes from a
   * restart point again. A frame whose data is cut short draws
   * the pixels it holds.
   */
  compose(frameIndex: number): Uint8ClampedArray<ArrayBuffer> {
    if (!(Number.isInteger(frameIndex) && frameIndex >= 0 && frameIndex < this.frameCount)) {
      throw new RangeError(`A GIF of ${this.frameCount} frames has no frame ${frameIndex}.`);
    }
    if (frameIndex === this.composedIndex) return this.canvas;
    const restartPoint = this.restartPointAtOrBefore(frameIndex);
    if (this.composedIndex === -1 || frameIndex < this.composedIndex || restartPoint > this.composedIndex) {
      this.startOverBefore(restartPoint);
    }
    try {
      for (let index = this.composedIndex + 1; index <= frameIndex; index++) this.composeNext(index);
    } catch (error) {
      this.composedIndex = -1;
      throw error;
    }
    return this.canvas;
  }

  /** Clears the canvas as it stands before the frame at `restartPoint`, none of the earlier frames' disposal due. */
  private startOverBefore(restartPoint: number): void {
    this.canvas.fill(0);
    this.saved = null;
    this.disposalDue = null;
    this.composedIndex = restartPoint - 1;
  }

  private composeNext(index: number): void {
    if (this.disposalDue !== null) this.dispose(this.disposalDue);
    const frame = this.file.frames[index]!;
    this.saved = frame.disposal === 'restore' ? this.saveAreaOf(frame) : null;
    this.draw(frame);
    this.disposalDue = frame;
    this.composedIndex = index;
  }

  private dispose(frame: GifFrameEntry): void {
    if (frame.disposal === 'clear') this.clearAreaOf(frame);
    else if (frame.disposal === 'restore' && this.saved !== null) this.restore(this.saved);
  }

  private draw(frame: GifFrameEntry): void {
    if (frame.minCodeSize === null) return;
    const palette = frame.localColorTable ?? this.file.globalColorTable ?? BLACK_COLOUR_TABLE;
    const pixelCount = frame.width * frame.height;
    if (this.indices.length < pixelCount) this.indices = new Uint8Array(pixelCount);
    const indices = this.indices.subarray(0, pixelCount);
    const decoded = this.lzw.decode(this.file.bytes, frame.dataOffset, frame.minCodeSize, indices);
    this.paint(frame, palette, indices, decoded);
  }

  /** Paints the first `decoded` of `indices`, row by row as stored, onto the canvas. */
  private paint(frame: GifFrameEntry, palette: Uint8Array, indices: Uint8Array, decoded: number): void {
    const canvasRows = frame.interlaced ? this.interlacedRowsOf(frame.height) : null;
    const columns = Math.min(frame.width, this.width - frame.left);
    for (let storedRow = 0; storedRow * frame.width < decoded; storedRow++) {
      const y = frame.top + (canvasRows === null ? storedRow : canvasRows[storedRow]!);
      if (y >= this.height) continue;
      const rowStart = storedRow * frame.width;
      const rowEnd = Math.min(rowStart + columns, decoded);
      let at = (y * this.width + frame.left) * CHANNELS;
      for (let index = rowStart; index < rowEnd; index++, at += CHANNELS) {
        const colour = indices[index]!;
        const paletteAt = colour * 3;
        if (colour === frame.transparentIndex || paletteAt + 2 >= palette.length) continue;
        this.canvas[at] = palette[paletteAt]!;
        this.canvas[at + 1] = palette[paletteAt + 1]!;
        this.canvas[at + 2] = palette[paletteAt + 2]!;
        this.canvas[at + 3] = OPAQUE;
      }
    }
  }

  /** For each row as an interlaced frame stores it, the row it lands on in the frame. */
  private interlacedRowsOf(height: number): Int32Array {
    const rows = new Int32Array(height);
    let storedRow = 0;
    for (const [start, step] of INTERLACE_PASSES) {
      for (let row = start; row < height; row += step) rows[storedRow++] = row;
    }
    return rows;
  }

  private saveAreaOf(frame: GifFrameEntry): SavedArea {
    const area = this.clippedAreaOf(frame);
    const pixels = new Uint8ClampedArray(area.width * area.height * CHANNELS);
    for (let row = 0; row < area.height; row++) {
      const from = ((area.top + row) * this.width + area.left) * CHANNELS;
      pixels.set(this.canvas.subarray(from, from + area.width * CHANNELS), row * area.width * CHANNELS);
    }
    return { ...area, pixels };
  }

  private restore(saved: SavedArea): void {
    for (let row = 0; row < saved.height; row++) {
      const from = row * saved.width * CHANNELS;
      this.canvas.set(saved.pixels.subarray(from, from + saved.width * CHANNELS), ((saved.top + row) * this.width + saved.left) * CHANNELS);
    }
  }

  private clearAreaOf(frame: GifFrameEntry): void {
    const area = this.clippedAreaOf(frame);
    for (let row = 0; row < area.height; row++) {
      const from = ((area.top + row) * this.width + area.left) * CHANNELS;
      this.canvas.fill(0, from, from + area.width * CHANNELS);
    }
  }

  /** The part of the canvas `frame` covers, cut at the canvas's edges. */
  private clippedAreaOf(frame: GifFrameEntry): Omit<SavedArea, 'pixels'> {
    const left = Math.min(frame.left, this.width);
    const top = Math.min(frame.top, this.height);
    return {
      left,
      top,
      width: Math.max(0, Math.min(frame.left + frame.width, this.width) - left),
      height: Math.max(0, Math.min(frame.top + frame.height, this.height) - top),
    };
  }

  private restartPointsOf(frames: ReadonlyArray<GifFrameEntry>): number[] {
    const points = [0];
    for (let index = 1; index < frames.length; index++) {
      const frame = frames[index]!;
      const before = frames[index - 1]!;
      // One to be restored afterwards puts back the canvas before it, so it only starts over when that canvas is known.
      const paintsOverEverything = this.coversCanvas(frame) && frame.transparentIndex === null && frame.disposal !== 'restore';
      const followsAClearedCanvas = this.coversCanvas(before) && before.disposal === 'clear';
      if (paintsOverEverything || followsAClearedCanvas) points.push(index);
    }
    return points;
  }

  private coversCanvas(frame: GifFrameEntry): boolean {
    return frame.left === 0 && frame.top === 0 && frame.width >= this.width && frame.height >= this.height;
  }

  /** The latest restart point at or before `frameIndex`. */
  private restartPointAtOrBefore(frameIndex: number): number {
    let low = 0;
    let high = this.restartPoints.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.restartPoints[middle]! <= frameIndex) low = middle;
      else high = middle - 1;
    }
    return this.restartPoints[low]!;
  }
}
