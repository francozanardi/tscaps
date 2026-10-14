import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';

/** Paints the captions on the decoded frame itself: every picture is the frame. */
export class VideoFrameBackdrop implements FrameBackdrop {

  beneath(frame: DecodedVideoFrame): DecodedVideoFrame {
    return frame;
  }

  sampledByCaptions(frame: DecodedVideoFrame): DecodedVideoFrame {
    return frame;
  }

  cutFrom(frame: DecodedVideoFrame): DecodedVideoFrame {
    return frame;
  }

  occluding(topLayer: OverlayFrame): OverlayFrame {
    return topLayer;
  }

  showsFramePixels(): boolean {
    return true;
  }

  isTransparent(): boolean {
    return false;
  }
}
