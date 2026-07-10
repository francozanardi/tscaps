import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';

/**
 * Owns a `MediaStream` cloned from the preview surface for the live
 * preview mirror. Returns `null` when the surface has no stream to
 * offer (source not yet loaded, host browser without `captureStream`,
 * etc.).
 *
 * Subscribers listen for `'change'` and read {@link getStream}.
 */
export class MainVideoStreamCaptureController extends EventTarget {

  private stream: MediaStream | null = null;

  constructor(private readonly surface: VideoPreviewSurface) {
    super();
  }

  start(): void {
    this.refresh();
  }

  stop(): void {
    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  private refresh(): void {
    const next = this.surface.captureStream();
    if (next === this.stream) return;
    this.stream = next;
    this.dispatchEvent(new Event('change'));
  }
}
