import { Mp4OutputFormat, WebMOutputFormat, getFirstEncodableVideoCodec } from 'mediabunny';
import type { VideoExportSupport } from '@core/export/domain/VideoExportSupport';

/**
 * mediabunny-backed implementation of {@link VideoExportSupport}. Asks
 * the browser for an encoder across the union of the video codecs the
 * two export containers accept, which is the same question the render
 * asks once it starts — a browser that answers nothing here fails
 * every export, whatever the user picks in the dialog.
 *
 * Asked without frame dimensions on purpose: a browser that encodes
 * nothing at any size is the blocker worth reporting upfront, and the
 * gate runs before the source video's dimensions are known.
 */
export class MediaBunnyVideoExportSupport implements VideoExportSupport {

  async isSupported(): Promise<boolean> {
    const codecs = [new Mp4OutputFormat(), new WebMOutputFormat()]
      .flatMap((format) => format.getSupportedVideoCodecs());
    return (await getFirstEncodableVideoCodec([...new Set(codecs)])) !== null;
  }
}
