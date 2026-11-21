import type { FootagePicture } from '@modules/video/FootagePicture';
import type { AnimationFrameTimeline } from '@modules/video/animation/AnimationFrameTimeline';
import type { AnimationFrame, AnimationFrameDecoder } from '@modules/video/animation/AnimationFrameDecoder';
import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';

interface HeldFrame {
  readonly index: number;
  readonly frame: AnimationFrame;
}

/**
 * {@link DrawableFootage} over an animation: the picture at a moment is
 * the frame its timeline answers there, decoded when it is first needed.
 *
 * Only the frame on show is held; the one it replaces is closed once the
 * new one is decoded, so memory does not grow with the animation's
 * length. Questions are answered in the order asked; those asked while a
 * frame is being decoded are coalesced into the latest of them.
 *
 * A frame that will not decode leaves the frame before it on show,
 * rather than failing; footage with none on show yet draws nothing.
 */
export class AnimatedImageFootage implements DrawableFootage {
  private held: HeldFrame | null = null;
  private wantedIndex = 0;
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private warned = false;

  constructor(
    private readonly timeline: AnimationFrameTimeline,
    private readonly decoder: AnimationFrameDecoder,
  ) {}

  get width(): number {
    return this.decoder.width;
  }

  get height(): number {
    return this.decoder.height;
  }

  async pictureAt(sourceSec: number): Promise<FootagePicture | null> {
    this.wantedIndex = this.timeline.frameIndexAt(sourceSec);
    this.queue = this.queue.then(() => this.showWanted());
    await this.queue;
    return this.held === null ? null : this;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    this.held?.frame.draw(context, dx, dy, dWidth, dHeight);
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.queue;
    this.held?.frame.close();
    this.held = null;
    this.decoder.close();
  }

  /**
   * Puts the frame wanted last on show, unless it already is. Every
   * question queues one of these, so those queued behind a decode find
   * the latest frame on show and have nothing left to do. Never rejects.
   */
  private async showWanted(): Promise<void> {
    const index = this.wantedIndex;
    if (this.closed || this.held?.index === index) return;
    const frame = await this.decodeOrNull(index);
    if (frame === null) return;
    if (this.closed) {
      frame.close();
      return;
    }
    this.held?.frame.close();
    this.held = { index, frame };
  }

  private async decodeOrNull(index: number): Promise<AnimationFrame | null> {
    try {
      return await this.decoder.decode(index);
    } catch (error) {
      if (!this.warned) console.warn(`[footage] an animation frame (${index}) could not be decoded; the frame before it stays on show`, error);
      this.warned = true;
      return null;
    }
  }
}
