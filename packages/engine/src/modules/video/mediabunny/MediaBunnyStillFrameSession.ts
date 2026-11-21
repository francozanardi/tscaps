import type { Input } from 'mediabunny';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';
import type { StillFrame, StillFrameSession } from '@modules/video/StillFrameSession';
import type { FramePainter } from '@modules/video/mediabunny/painter/FramePainter';
import type { OutputFrameCanvas } from '@modules/video/mediabunny/encoder/OutputFrameCanvas';
import type { ShownSourceFrameSeeker } from '@modules/video/mediabunny/frame/ShownSourceFrameSeeker';

/**
 * {@link StillFrameSession} over one open input: each frame is the
 * input frame shown at the moment asked, handed to the painter as a run
 * of one and painted on an output-frame canvas, which hands its pixels
 * over as the bitmap.
 *
 * Owns the input and the painter it is given, already begun, and ends
 * both on {@link close}.
 */
export class MediaBunnyStillFrameSession implements StillFrameSession {

  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly input: Input,
    private readonly frames: ShownSourceFrameSeeker,
    private readonly painter: FramePainter,
    private readonly timeMap: RenderTimeMap,
    private readonly frameCanvas: OutputFrameCanvas,
  ) {}

  get width(): number {
    return this.frameCanvas.width;
  }

  get height(): number {
    return this.frameCanvas.height;
  }

  frameAt(sourceSec: number): Promise<StillFrame> {
    return this.oneAtATime(() => this.paintAt(sourceSec));
  }

  close(): Promise<void> {
    return this.oneAtATime(async () => {
      if (this.closed) return;
      this.closed = true;
      this.painter.end();
      this.input.dispose();
    });
  }

  /** Runs `work` once every call made before it has settled, whichever way each settled. */
  private oneAtATime<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async paintAt(sourceSec: number): Promise<StillFrame> {
    if (this.closed) throw new Error('A still frame was asked of a closed session.');
    const frame = await this.frames.frameShownAt(sourceSec);
    try {
      const outputSec = this.timeMap.toOutputTime(frame.timestamp);
      const [paint] = await this.painter.paint([{ frame, outputTimestamp: outputSec }]);
      if (paint === undefined) throw new Error('The painter returned no paint step for the frame.');
      this.frameCanvas.paint(paint);
      return { bitmap: this.frameCanvas.canvas.transferToImageBitmap(), sourceSec: frame.timestamp, outputSec };
    } finally {
      frame.close();
    }
  }
}
