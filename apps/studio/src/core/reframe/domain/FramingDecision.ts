/**
 * How a stretch of the video is framed: the point of the source picture
 * put in the middle of the frame, and how close (1 is the frame's own
 * closeness). Along an axis the frame shows whole at that closeness the
 * point moves nothing: it is where the subject's head is, which a closer
 * view later keeps in place, or the picture's middle (`y` null) where
 * the framing names no subject.
 */
export interface FramingDecision {
  readonly x: number;
  readonly y: number | null;
  readonly scale: number;
}
