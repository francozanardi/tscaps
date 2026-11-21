import type { MediaAsset } from '@core/media/domain/MediaAsset';

/** A file's own picture at one moment. */
export interface MediaFilePicture {
  /** The moment, in seconds of the file's own timeline from its start; null for a still picture. */
  readonly fileSec: number | null;
  readonly bitmap: ImageBitmap;
}

/**
 * Pictures of a media file as it is, before anything uses it: a still
 * picture once, a GIF or a video at chosen moments of its own timeline.
 * No side is longer than asked. The caller closes the bitmaps.
 */
export interface MediaFilePictures {
  /**
   * `asset` at `fileSecs` (ascending; ignored for a still picture). A
   * moment the file holds no picture at is left out; a GIF starts over
   * each time it runs out. Rejects when the file's bytes cannot be had
   * or read, and for an audio file, which has no picture.
   */
  picturesOf(asset: MediaAsset, fileSecs: ReadonlyArray<number>, maxSidePx: number, signal: AbortSignal): Promise<ReadonlyArray<MediaFilePicture>>;
}
