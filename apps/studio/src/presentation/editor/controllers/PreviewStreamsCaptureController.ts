import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';

/** The preview's pictures as streams: the video's own, and the footage inserted over it. */
export interface PreviewStreams {
  readonly video: MediaStream | null;
  readonly footage: MediaStream | null;
}

const NO_STREAMS: PreviewStreams = { video: null, footage: null };

/**
 * Owns the streams captured from the preview surface for the live
 * preview mirror, and captures them again when the surface changes
 * variant, whose presentation elements are then new. A stream is
 * `null` when the surface has none to offer (nothing mounted, a host
 * browser without `captureStream`).
 *
 * Subscribers listen for `'change'` and read {@link getStreams}.
 */
export class PreviewStreamsCaptureController extends EventTarget {

  private streams: PreviewStreams = NO_STREAMS;

  constructor(private readonly surface: VideoPreviewSurface) {
    super();
  }

  start(): void {
    this.surface.addEventListener('variantchange', this.refresh);
    this.refresh();
  }

  stop(): void {
    this.surface.removeEventListener('variantchange', this.refresh);
    this.streams = NO_STREAMS;
  }

  getStreams(): PreviewStreams {
    return this.streams;
  }

  private readonly refresh = (): void => {
    this.streams = { video: this.surface.captureStream(), footage: this.surface.captureFootageStream() };
    this.dispatchEvent(new Event('change'));
  };
}
