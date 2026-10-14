import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { SolidColorVideoFrame } from '@modules/video/mediabunny/frame/SolidColorVideoFrame';
import { ClearedVideoFrame } from '@modules/video/mediabunny/frame/ClearedVideoFrame';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';

/**
 * Paints the captions on a solid colour in place of the decoded frame.
 *
 * A top layer cuts its pixels from the same colour, so whatever it
 * occludes reads as background: keyed out later, the occluded captions
 * go with it. A caption that samples the video sees nothing rather than
 * the colour, so a blend in its style leaves it plain instead of mixing
 * the key colour into it.
 */
export class SolidColorFrameBackdrop implements FrameBackdrop {

  /** @param color Any CSS colour. Expected opaque; a translucent one is painted as given. */
  constructor(private readonly color: string) {}

  beneath(frame: DecodedVideoFrame): DecodedVideoFrame {
    return new SolidColorVideoFrame(frame, this.color);
  }

  sampledByCaptions(frame: DecodedVideoFrame): DecodedVideoFrame {
    return new ClearedVideoFrame(frame);
  }

  cutFrom(frame: DecodedVideoFrame): DecodedVideoFrame {
    return new SolidColorVideoFrame(frame, this.color);
  }

  occluding(topLayer: OverlayFrame): OverlayFrame {
    return topLayer;
  }

  showsFramePixels(): boolean {
    return false;
  }

  isTransparent(): boolean {
    return false;
  }
}
