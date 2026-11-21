import type { RenderJob } from '@modules/video/RenderJob';
import type { StillFrameSession } from '@modules/video/StillFrameSession';

/**
 * The part of a {@link RenderJob} that says what its output frames look
 * like, read exactly as a render reads it. A job built for a render is
 * one of these as it stands.
 */
export type StillFrameJob = Pick<
  RenderJob,
  'video' | 'document' | 'styles' | 'overlayHtml' | 'topLayer' | 'footage' | 'background' | 'frame' | 'skipRanges'
>;

/**
 * Paints single output frames of a job, through the same compositing a
 * render of that job goes through, so a frame painted here is the frame
 * the render writes at the same moment. Nothing is encoded.
 */
export interface StillFrameRenderer {
  /**
   * Opens a session that paints `job`'s output frames: reads the video's
   * track and readies everything that paints over it. Rejects when the
   * video has no video track or its frames cannot be decoded here. The
   * session is the caller's to close.
   */
  open(job: StillFrameJob): Promise<StillFrameSession>;
}
