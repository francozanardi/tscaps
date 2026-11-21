/** One output frame, painted. */
export interface StillFrame {
  /** The frame at the output's full size. The receiver closes it. */
  readonly bitmap: ImageBitmap;
  /**
   * Where on the input's timeline the frame shown comes from: the frame
   * on screen at the time asked, or, for a time the output leaves out,
   * the first frame shown after it.
   */
  readonly sourceSec: number;
  /** Where that frame lands on the output's timeline, once the skipped ranges are taken out. */
  readonly outputSec: number;
}

/**
 * An open job, ready to paint any of its output frames, in any order.
 *
 * Calls are served one at a time, in the order they were made. A
 * failing call rejects alone: the session goes on serving the next.
 */
export interface StillFrameSession {
  /** The output frame's size, which every bitmap has. */
  readonly width: number;
  readonly height: number;

  /**
   * The output frame showing the input at `sourceSec` seconds. Rejects
   * when something the frame draws cannot be drawn, such as footage
   * whose picture for that moment cannot be had, and once the session
   * is closed.
   */
  frameAt(sourceSec: number): Promise<StillFrame>;

  /** Lets go of everything the session holds, once any call in flight has settled. Idempotent. */
  close(): Promise<void>;
}
