import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { FootageLayer } from '@modules/video/FootageLayer';
import type { AnimatedImageOpener } from '@modules/video/animation/AnimatedImageOpener';
import { BackdropFootage } from '@modules/video/mediabunny/footage/BackdropFootage';
import { DecodedVideoFootage } from '@modules/video/mediabunny/footage/DecodedVideoFootage';
import { FootageDecodeCursor } from '@modules/video/mediabunny/footage/FootageDecodeCursor';
import type { FootageOpener } from '@modules/video/mediabunny/footage/FootageOpener';
import { ImageBitmapFootage } from '@modules/video/mediabunny/footage/ImageBitmapFootage';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';
import { ProvidedFootage } from '@modules/video/provided/ProvidedFootage';
import { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';

// What is opened here is composed at its own size.
const FULL_SIZE = 1;

/**
 * {@link FootageOpener} that decodes a video through mediabunny and
 * WebCodecs, over the layer's pass from its start, an image once
 * through `createImageBitmap`, a GIF through `gifs`, and a backdrop as
 * the placeholder the compositor draws the frame beneath in place of,
 * and provided pictures by opening their provider. A
 * video the browser cannot decode rejects, and so does a layer showing
 * the source's own picture, which has no file to open.
 */
export class MediaBunnyFootageOpener implements FootageOpener {
  constructor(private readonly gifs: AnimatedImageOpener) {}

  async open(layer: FootageLayer): Promise<OpenedFootage> {
    const { source } = layer;
    switch (source.kind) {
      case 'image':
        return new ImageBitmapFootage(await createImageBitmap(source.blob));
      case 'gif':
        return this.gifs.open(source.blob);
      case 'video':
        return this.openVideo(layer, source.blob);
      case 'source-picture':
        throw new Error('A layer showing the source\'s own picture has no footage to open.');
      case 'backdrop':
        return new BackdropFootage();
      case 'provided':
        return new ProvidedFootage(await source.provider.open(FULL_SIZE));
    }
  }

  private async openVideo(layer: FootageLayer, blob: Blob): Promise<OpenedFootage> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error('A footage video has no video track.');
      if (!(await track.canDecode())) {
        throw new Error(`A footage video uses a codec this browser cannot decode (${await track.getCodec() ?? 'unknown'}).`);
      }
      const span = { startSec: layer.sourceStartSec, endSec: layer.sourceStartSec + layer.sourcePassSec };
      return new DecodedVideoFootage(
        input,
        new FootageDecodeCursor(new WebCodecsVideoFrameDecoder(track), span),
        await track.getDisplayWidth(),
        await track.getDisplayHeight(),
      );
    } catch (error) {
      input.dispose();
      throw error;
    }
  }
}
