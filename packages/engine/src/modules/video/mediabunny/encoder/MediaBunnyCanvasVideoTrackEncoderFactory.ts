import { MediaBunnyCanvasVideoTrackEncoder } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoder';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type {
  VideoTrackEncoderFactory,
  VideoTrackEncoderFactoryRequest,
} from '@modules/video/mediabunny/encoder/VideoTrackEncoderFactory';

/**
 * Produces canvas-backed encoders that wrap mediabunny's
 * {@link CanvasSource}.
 */
export class MediaBunnyCanvasVideoTrackEncoderFactory implements VideoTrackEncoderFactory {

  create(request: VideoTrackEncoderFactoryRequest): VideoTrackEncoder {
    return new MediaBunnyCanvasVideoTrackEncoder({
      width: request.width,
      height: request.height,
      encoderConfig: request.encoderConfig,
    });
  }
}
