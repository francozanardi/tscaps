/**
 * The ids of the footage layers that put the video in an output frame
 * of another shape, which its stylesheet addresses their boxes by.
 */
export enum OutputFrameLayerId {
  /** The video itself, filled or fitted into the frame. */
  VIDEO = 'output-frame-video',

  /** The video again beneath a fitted one, blurred, covering the frame. */
  BACKDROP = 'output-frame-backdrop',
}
