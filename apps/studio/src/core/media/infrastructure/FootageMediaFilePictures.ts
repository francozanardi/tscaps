import type { FootageLayer } from '@tscaps/engine';
import type { FootageOpener, OpenedFootage } from '@tscaps/engine/advanced';
import type { MediaFilePicture, MediaFilePictures } from '@core/media/domain/MediaFilePictures';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';

/**
 * {@link MediaFilePictures} read through the engine's footage opener, the
 * same one the export draws layers with, from the file's original bytes:
 * what the model sees of a file is what a shot showing it would draw.
 */
export class FootageMediaFilePictures implements MediaFilePictures {
  constructor(
    private readonly bytes: MediaAssetBytesRepository,
    private readonly footage: FootageOpener,
  ) {}

  async picturesOf(asset: MediaAsset, fileSecs: ReadonlyArray<number>, maxSidePx: number, signal: AbortSignal): Promise<ReadonlyArray<MediaFilePicture>> {
    if (asset.type === 'audio') throw new Error(`${asset.fileName} is an audio file, which has no picture`);
    const blob = await this.bytes.load(asset.id, 'original');
    if (blob === null) throw new Error(`The bytes of ${asset.fileName} could not be had`);
    signal.throwIfAborted();
    const opened = await this.footage.open(this.layerOf(asset.type, blob));
    const pictures: MediaFilePicture[] = [];
    try {
      const moments: ReadonlyArray<number | null> = asset.type === 'image' ? [null] : fileSecs;
      for (const moment of moments) {
        signal.throwIfAborted();
        const bitmap = await this.pictureAt(opened, moment ?? 0, maxSidePx);
        if (bitmap !== null) pictures.push({ fileSec: moment, bitmap });
      }
      return pictures;
    } catch (error) {
      for (const picture of pictures) picture.bitmap.close();
      throw error;
    } finally {
      await opened.close();
    }
  }

  private layerOf(type: 'video' | 'image' | 'gif', blob: Blob): FootageLayer {
    return { id: 'media-file', source: { kind: type, blob }, outputStartSec: 0, outputEndSec: Infinity, sourceStartSec: 0, sourcePassSec: Infinity };
  }

  private async pictureAt(opened: OpenedFootage, fileSec: number, maxSidePx: number): Promise<ImageBitmap | null> {
    const picture = await opened.pictureAt(fileSec);
    if (picture === null || opened.width <= 0 || opened.height <= 0) return null;
    const scale = Math.min(1, maxSidePx / Math.max(opened.width, opened.height));
    const width = Math.max(1, Math.round(opened.width * scale));
    const height = Math.max(1, Math.round(opened.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D context to draw a media file on');
    picture.draw(context, 0, 0, width, height);
    return createImageBitmap(canvas);
  }
}
