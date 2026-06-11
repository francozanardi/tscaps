import type { VideoFrameSource, VideoFrameRegion } from '@modules/rendering/VideoFrameSource';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { profiler } from '@modules/profiling/Profiler';

/**
 * Single-slot `VideoFrameSource`. {@link setCurrent} stores one
 * decoded frame at a timestamp; {@link getFrameAt} serves only that
 * frame and only at that same timestamp. Querying any other
 * timestamp throws.
 */
export class CurrentFrameVideoSource implements VideoFrameSource {

  // Any mismatch beyond IEEE-754 noise is a coordination bug between
  // the producer and the subtitle renderer.
  private static readonly TIMESTAMP_TOLERANCE_S = 1e-6;

  private readonly canvas: OffscreenCanvas;
  private readonly ctx: OffscreenCanvasRenderingContext2D;
  private currentTimestamp: number | null = null;

  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas 2D context is not available in this environment.');
    }
    this.ctx = ctx;
  }

  /**
   * Stores `frame` as the only frame `getFrameAt` will serve until
   * the next `setCurrent`, keyed on `timestamp`.
   */
  setCurrent(timestamp: number, frame: DecodedVideoFrame): void {
    this.currentTimestamp = timestamp;
    profiler.time('CurrentFrameVideoSource.draw', () =>
      frame.draw(this.ctx, 0, 0, this.canvas.width, this.canvas.height),
    );
  }

  async getFrameAt(timeSeconds: number, jpegQuality: number, region?: VideoFrameRegion): Promise<string> {
    if (this.currentTimestamp === null) {
      throw new Error('CurrentFrameVideoSource.getFrameAt called before any setCurrent.');
    }
    if (Math.abs(this.currentTimestamp - timeSeconds) > CurrentFrameVideoSource.TIMESTAMP_TOLERANCE_S) {
      throw new Error(
        `CurrentFrameVideoSource: requested timestamp ${timeSeconds}, ` +
          `but the current slot holds ${this.currentTimestamp}.`,
      );
    }
    const blob = await profiler.time('CurrentFrameVideoSource.convertToBlob', () =>
      this.encode(region, jpegQuality),
    );
    return profiler.time('CurrentFrameVideoSource.blobToDataUrl', () => this.blobToDataUrl(blob));
  }

  private encode(region: VideoFrameRegion | undefined, jpegQuality: number): Promise<Blob> {
    if (!region) {
      return this.canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQuality });
    }
    const clipped = this.clipToCanvas(region);
    if (clipped.width === 0 || clipped.height === 0) {
      return this.canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQuality });
    }
    const cropCanvas = new OffscreenCanvas(clipped.width, clipped.height);
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) {
      throw new Error('OffscreenCanvas 2D context is not available for cropping.');
    }
    cropCtx.drawImage(
      this.canvas,
      clipped.x, clipped.y, clipped.width, clipped.height,
      0, 0, clipped.width, clipped.height,
    );
    return cropCanvas.convertToBlob({ type: 'image/jpeg', quality: jpegQuality });
  }

  private clipToCanvas(region: VideoFrameRegion): VideoFrameRegion {
    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const right = Math.min(this.canvas.width, Math.ceil(region.x + region.width));
    const bottom = Math.min(this.canvas.height, Math.ceil(region.y + region.height));
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed to encode the frame.'));
      reader.readAsDataURL(blob);
    });
  }
}
