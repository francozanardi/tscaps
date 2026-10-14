import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { ClearedVideoFrame } from '@modules/video/mediabunny/frame/ClearedVideoFrame';
import { SolidColorVideoFrame } from '@modules/video/mediabunny/frame/SolidColorVideoFrame';
import { ErasingOverlayFrame } from '@modules/video/mediabunny/frame/ErasingOverlayFrame';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';

/**
 * Paints the captions on nothing, leaving every pixel they do not cover
 * fully transparent.
 *
 * A top layer has nothing to paint over the captions here, so it erases
 * them instead: it is cut from an opaque stand-in, which gives it the
 * occluder's shape and coverage and nothing else, and composited as an
 * eraser. The colour of the stand-in never reaches the output.
 *
 * A caption that samples the video is handed the empty picture too.
 */
export class TransparentFrameBackdrop implements FrameBackdrop {

  private static readonly OCCLUDER_STAND_IN = '#000';

  beneath(frame: DecodedVideoFrame): DecodedVideoFrame {
    return new ClearedVideoFrame(frame);
  }

  sampledByCaptions(frame: DecodedVideoFrame): DecodedVideoFrame {
    return new ClearedVideoFrame(frame);
  }

  cutFrom(frame: DecodedVideoFrame): DecodedVideoFrame {
    return new SolidColorVideoFrame(frame, TransparentFrameBackdrop.OCCLUDER_STAND_IN);
  }

  occluding(topLayer: OverlayFrame): OverlayFrame {
    return new ErasingOverlayFrame(topLayer);
  }

  showsFramePixels(): boolean {
    return false;
  }

  isTransparent(): boolean {
    return true;
  }
}
