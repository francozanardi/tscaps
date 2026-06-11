import type { Output } from 'mediabunny';

/** Callback the encoder runs against its own 2D context on every frame. */
export type PaintFrame = (target: OffscreenCanvasRenderingContext2D) => void;

/**
 * Encodes successive frames into a mediabunny {@link Output}. The
 * encoder owns its underlying surface and never exposes it; callers
 * describe what to paint via the {@link PaintFrame} callback passed
 * to {@link encode}.
 *
 * Output dimensions are fixed at construction time.
 */
export interface VideoTrackEncoder {
  readonly width: number;
  readonly height: number;
  /**
   * Wires the encoder's source into the output. Must be called once
   * before the output is started.
   */
  attachTo(output: Output): void;
  /**
   * Runs `paint` against the encoder's internal surface, snapshots the
   * result, and queues it for encoding at the given presentation
   * timestamp and duration (both in seconds). The returned promise
   * resolves once the encoder is ready to receive the next frame —
   * await it to honor backpressure.
   */
  encode(timestamp: number, duration: number, paint: PaintFrame): Promise<void>;
}
