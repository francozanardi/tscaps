import { Mp4OutputFormat, getFirstEncodableVideoCodec } from 'mediabunny';
import type { CodecSupportChecker } from '@core/browser-support/domain/CodecSupportChecker';

/**
 * `CodecSupportChecker` that delegates to mediabunny's encoder
 * discovery against the MP4 container's supported video codecs. Asks
 * for HD-sized encoding to weed out browsers that advertise a codec
 * but refuse to instantiate an encoder at realistic resolutions.
 */
export class MediaBunnyCodecSupportChecker implements CodecSupportChecker {

  async canEncodeMp4(): Promise<boolean> {
    if (typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'undefined') {
      return false;
    }
    try {
      const mp4 = new Mp4OutputFormat();
      const codec = await getFirstEncodableVideoCodec(mp4.getSupportedVideoCodecs(), {
        width: 1280,
        height: 720,
      });
      return codec !== null;
    } catch {
      return false;
    }
  }
}
