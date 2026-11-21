import type { FootagePass, FootagePicture } from '@tscaps/engine/advanced';

/** A pass's picture as last painted, with its own size in pixels. */
export interface HeldFootagePicture {
  readonly picture: FootagePicture;
  readonly width: number;
  readonly height: number;
}

/**
 * Plays one pass of a footage layer and holds the picture it is at, for
 * the layer to compose. Positions are output time.
 *
 * Opening is asynchronous; what is asked before it opens is kept, and
 * only the latest request is carried out once it does. Footage that
 * cannot be opened leaves the pass holding no picture.
 */
export interface FootagePlayer {
  readonly pass: FootagePass;

  open(): void;
  isStreaming(): boolean;
  /** Streams from `fromOutputSec`, or from the pass's start when that is later. */
  stream(fromOutputSec: number): void;
  still(atOutputSec: number): void;
  scrub(atOutputSec: number): void;
  idle(): void;
  dispose(): void;

  /** The picture painted last inside the pass, or null before the first one lands. */
  picture(): HeldFootagePicture | null;
}
