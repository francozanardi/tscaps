/**
 * Why a host would not hold a raster of the size it was offered.
 *
 * - `no-context` — the surface gave back no 2D context.
 * - `blank-edge` — it drew, but the far corner came back unpainted.
 * - `distorted-edge` — the far corner was painted, but effects drawn
 *   there came back unlike the same effects drawn at the origin.
 * - `error` — decoding, allocating or reading back threw.
 */
export type SpriteSheetRasterRefusal = 'no-context' | 'blank-edge' | 'distorted-edge' | 'error';

/** `refusal` is `null` when the host held the raster whole. */
export interface SpriteSheetRasterOutcome {
  readonly refusal: SpriteSheetRasterRefusal | null;
  readonly cause?: unknown;
}

/** Asks a host whether it can hold one raster of a given size and read it back whole. */
export interface SpriteSheetRasterProbe {
  /** Never rejects: a host that will not hold the raster is an answer, not a failure. */
  offer(width: number, height: number): Promise<SpriteSheetRasterOutcome>;
}
