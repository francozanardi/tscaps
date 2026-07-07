import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';

interface BufferedFrame {
  readonly outputTimeSec: number;
  readonly frame: PreviewVideoFrame;
}

/**
 * Bounded buffer of decoded frames in target-output-time order.
 *
 * The decode loop pushes frames as the decoder yields them — for
 * forward playback that arrival order is also the output-time
 * order, so this class assumes monotonic pushes and does not
 * sort. The paint loop pulls the latest frame whose output time
 * has been reached, dropping older entries in the same call so
 * the buffer never holds stale work.
 *
 * The buffer caps at {@link maxFrames}. Callers should check
 * {@link isFull} before pushing and back off when the cap is hit,
 * which is the back-pressure signal that decouples decoder speed
 * from clock speed and keeps memory bounded.
 *
 * Closing a frame releases its underlying decoder resource. The
 * buffer closes every frame it drops or clears; the caller owns
 * the lifecycle of any frame returned by {@link takeLatestUpTo}
 * (paint it, then close it).
 */
export class FrameBuffer {

  private readonly frames: BufferedFrame[] = [];

  constructor(private readonly maxFrames: number) {}

  size(): number {
    return this.frames.length;
  }

  isFull(): boolean {
    return this.frames.length >= this.maxFrames;
  }

  headOutputTimeSec(): number | null {
    return this.frames.length === 0 ? null : this.frames[0]!.outputTimeSec;
  }

  tailOutputTimeSec(): number | null {
    return this.frames.length === 0 ? null : this.frames[this.frames.length - 1]!.outputTimeSec;
  }

  push(frame: PreviewVideoFrame, outputTimeSec: number): void {
    this.frames.push({ frame, outputTimeSec });
  }

  takeLatestUpTo(outputTimeSec: number): PreviewVideoFrame | null {
    const lastReachedIndex = this.findLastReachedIndex(outputTimeSec);
    if (lastReachedIndex === -1) return null;
    this.closeFramesBefore(lastReachedIndex);
    const taken = this.frames[lastReachedIndex]!.frame;
    this.frames.splice(0, lastReachedIndex + 1);
    return taken;
  }

  clear(): void {
    for (const buffered of this.frames) {
      buffered.frame.close();
    }
    this.frames.length = 0;
  }

  private findLastReachedIndex(outputTimeSec: number): number {
    let lastReached = -1;
    for (let i = 0; i < this.frames.length; i++) {
      if (this.frames[i]!.outputTimeSec <= outputTimeSec) lastReached = i;
      else break;
    }
    return lastReached;
  }

  private closeFramesBefore(index: number): void {
    for (let i = 0; i < index; i++) {
      this.frames[i]!.frame.close();
    }
  }
}
