import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { DecodedFramePayload } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';

/**
 * Adapter that exposes an {@link ImageBitmap} received from the
 * decode worker as a domain-shaped {@link PreviewVideoFrame}. The
 * worker has already produced a standalone GPU-backed bitmap and
 * transferred ownership across the message port, so the frame can
 * be painted or buffered without another copy. The bitmap is owned
 * by this instance until {@link close} runs.
 */
export class WorkerBitmapPreviewVideoFrame implements PreviewVideoFrame {

  constructor(private readonly payload: DecodedFramePayload) {}

  get timestampSec(): number {
    return this.payload.timestampSec;
  }

  get widthPx(): number {
    return this.payload.widthPx;
  }

  get heightPx(): number {
    return this.payload.heightPx;
  }

  get bitmap(): CanvasImageSource {
    return this.payload.bitmap;
  }

  close(): void {
    this.payload.bitmap.close();
  }
}
