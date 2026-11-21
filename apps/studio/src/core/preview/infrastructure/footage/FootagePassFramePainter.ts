import type { FramePainter } from '@core/preview/domain/FramePainter';
import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { FootagePassTimeSource } from '@core/preview/infrastructure/footage/FootagePassTimeSource';

/**
 * Paints one pass's frames only while playback is inside that pass,
 * so a pass decoding ahead of its start, or past its end, never puts a
 * frame on screen. `onPainted` runs after every frame that lands.
 */
export class FootagePassFramePainter implements FramePainter {
  constructor(
    private readonly target: FramePainter,
    private readonly time: FootagePassTimeSource,
    private readonly onPainted: () => void,
  ) {}

  setIntrinsicSize(widthPx: number, heightPx: number): void {
    this.target.setIntrinsicSize(widthPx, heightPx);
  }

  paint(frame: PreviewVideoFrame): void {
    if (!this.time.coversNow()) return;
    this.target.paint(frame);
    this.onPainted();
  }

  clear(): void {
    this.target.clear();
  }
}
