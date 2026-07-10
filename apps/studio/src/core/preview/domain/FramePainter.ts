import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';

/**
 * Paints decoded video frames onto a presentation surface with
 * `contain` fitting against a configurable intrinsic aspect ratio.
 * Implementations may choose any rendering technology.
 */
export interface FramePainter {
  setIntrinsicSize(widthPx: number, heightPx: number): void;
  paint(frame: PreviewVideoFrame): void;
  clear(): void;
}
