/**
 * What happens to the area a frame drew once the next frame is due:
 * `keep` leaves it (both the "unspecified" and the "do not dispose" of
 * the format), `clear` makes it transparent, `restore` puts back what
 * was there before the frame drew.
 */
export type GifDisposal = 'keep' | 'clear' | 'restore';

/** The fields a graphic control block sets for the frame after it. */
export interface GifFrameControl {
  /** The delay it states, in hundredths of a second; null for a frame without one. */
  readonly delayHundredths: number | null;
  readonly disposal: GifDisposal;
  /** The colour index drawn as nothing; null when the frame has none. */
  readonly transparentIndex: number | null;
}

/** One frame as the file lays it out, its pixels still compressed. */
export interface GifFrameEntry extends GifFrameControl {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Whether its rows are stored in the four interlace passes rather than top to bottom. */
  readonly interlaced: boolean;
  /** Its own colour table, RGB triples; null when it uses the global one. */
  readonly localColorTable: Uint8Array | null;
  /** The LZW minimum code size; null where the file ends before it. */
  readonly minCodeSize: number | null;
  /** Where its first data sub-block (the size byte) starts in the file's bytes. */
  readonly dataOffset: number;
}

/**
 * The block structure of a GIF, its pixels still compressed: the
 * canvas, the global colour table, the loop count, and every frame's
 * control fields and where its data starts. Its frames point into
 * `bytes`.
 */
export interface GifFile {
  readonly bytes: Uint8Array;
  /** The canvas the frames are drawn on: the logical screen, or the first frame's extent where the screen states no size. */
  readonly width: number;
  readonly height: number;
  /** RGB triples; null when the file has none. */
  readonly globalColorTable: Uint8Array | null;
  /** The NETSCAPE2.0 loop count: null without one, 0 for ever, N for N repeats after the first run. */
  readonly loopCount: number | null;
  readonly frames: ReadonlyArray<GifFrameEntry>;
}
