import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * What an output frame is painted on, and what follows from it for the
 * layers that read that picture.
 *
 * Four pictures depend on it, and they are not always the same one: the
 * base of the frame; what a caption sampling the video is handed; the
 * picture a top layer cuts its occluding pixels out of; and how that top
 * layer lands on the frame. With nothing beneath the captions, a top
 * layer cannot occlude by painting over them — it has to erase them.
 *
 * Stateless: one instance may serve any number of frames and renders.
 */
export interface FrameBackdrop {
  /** The picture at the base of the frame. Does not own `frame`. */
  beneath(frame: DecodedVideoFrame): DecodedVideoFrame;
  /** What a caption that samples the video is handed. Does not own `frame`. */
  sampledByCaptions(frame: DecodedVideoFrame): DecodedVideoFrame;
  /** The picture a top layer cuts its pixels from. Does not own `frame`. */
  cutFrom(frame: DecodedVideoFrame): DecodedVideoFrame;
  /** The top layer as it should be composited over the captions beneath it. */
  occluding(topLayer: OverlayFrame): OverlayFrame;
  /**
   * Whether any picture above shows the decoded frame's pixels. When not, nothing needs
   * decoding, and captions blend with nothing: they are composited and sampled plain.
   */
  showsFramePixels(): boolean;
  /** Whether the painted frames carry transparency the encoder has to keep. */
  isTransparent(): boolean;
}
