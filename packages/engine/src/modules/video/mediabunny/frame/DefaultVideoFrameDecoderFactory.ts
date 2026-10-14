import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type {
  VideoFrameDecoderFactory,
  VideoFrameDecoderRequest,
} from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
import { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';
import { HtmlVideoElementVideoFrameDecoder } from '@modules/video/mediabunny/frame/HtmlVideoElementVideoFrameDecoder';
import { PacketTimingVideoFrameDecoder } from '@modules/video/mediabunny/frame/PacketTimingVideoFrameDecoder';

/**
 * Probes the input track for WebCodecs decodability and returns the fast
 * path when supported. When it isn't, asks the caller (via the optional
 * `confirmFallback` callback) whether to proceed with the slower decoder
 * and aborts with an `AbortError` if the caller declines. A request
 * that needs no pixels gets the packets' timing and nothing is decoded.
 */
export class DefaultVideoFrameDecoderFactory implements VideoFrameDecoderFactory {

  async create(request: VideoFrameDecoderRequest): Promise<VideoFrameDecoder> {
    const inputCodec = (await request.track.getCodec()) ?? 'unknown';
    if (!request.pixels) {
      request.onDecoderSelected?.({ kind: 'packet-timing', inputCodec });
      return new PacketTimingVideoFrameDecoder(request.track);
    }
    const webCodecsCapable = await request.track.canDecode();
    if (webCodecsCapable) {
      request.onDecoderSelected?.({ kind: 'web-codecs', inputCodec });
      return new WebCodecsVideoFrameDecoder(request.track);
    }
    if (request.confirmFallback) {
      const accepted = await request.confirmFallback({ inputCodec });
      if (!accepted) {
        throw new DOMException('Fallback decoder declined by the caller.', 'AbortError');
      }
    }
    request.onDecoderSelected?.({ kind: 'html-video-element', inputCodec });
    return new HtmlVideoElementVideoFrameDecoder(request.source, inputCodec);
  }
}
