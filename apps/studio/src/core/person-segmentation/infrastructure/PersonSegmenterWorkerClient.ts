import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';
import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import { PendingWorkerRequests } from '@core/person-segmentation/infrastructure/PendingWorkerRequests';
import { PersonSegmenterModelUrls } from '@core/person-segmentation/infrastructure/PersonSegmenterModelUrls';
import type {
  PersonSegmenterWorkerInbound,
  PersonSegmenterWorkerOutbound,
} from '@core/person-segmentation/infrastructure/workers/PersonSegmenterWorkerProtocol';

/**
 * Main-thread facade over the person-segmenter Worker. Exposes the
 * three worker operations as awaitable methods, hiding the message
 * protocol and the request/reply correlation. Ownership of the
 * Worker is external — construction and disposal happen at the
 * composition root.
 */
export class PersonSegmenterWorkerClient {
  private readonly pending = new PendingWorkerRequests();
  private initialized = false;
  private initializing: Promise<void> | null = null;

  constructor(private readonly worker: Worker) {
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerError);
    this.worker.addEventListener('messageerror', () => {
      console.error('[person-segmenter worker] messageerror');
    });
  }

  async ensureReady(maskMaxSide: number): Promise<void> {
    if (this.initialized) return;
    if (this.initializing !== null) return this.initializing;
    const requestId = this.pending.reserveId();
    const done = this.pending.register<void>(requestId);
    this.postInit(requestId, maskMaxSide);
    this.initializing = done.then(() => {
      this.initialized = true;
      this.initializing = null;
    }).catch((error) => {
      this.initializing = null;
      throw error;
    });
    return this.initializing;
  }

  async detectPose(bitmap: ImageBitmap, timestampMs: number): Promise<ReadonlyArray<PoseLandmark>> {
    const requestId = this.pending.reserveId();
    const promise = this.pending.register<ReadonlyArray<PoseLandmark>>(requestId);
    this.worker.postMessage(
      { type: 'detect-pose', requestId, bitmap, timestampMs } satisfies PersonSegmenterWorkerInbound,
      [bitmap],
    );
    return promise;
  }

  async segmentPerson(bitmap: ImageBitmap, timestampMs: number, timestampSec: number): Promise<PersonSegmentationMask> {
    const requestId = this.pending.reserveId();
    const promise = this.pending.register<PersonSegmentationMask>(requestId);
    this.worker.postMessage(
      { type: 'segment-person', requestId, bitmap, timestampMs, timestampSec } satisfies PersonSegmenterWorkerInbound,
      [bitmap],
    );
    return promise;
  }

  private postInit(requestId: number, maskMaxSide: number): void {
    const message: PersonSegmenterWorkerInbound = {
      type: 'init',
      requestId,
      wasmPath: PersonSegmenterModelUrls.WASM_PATH,
      poseModelUrl: PersonSegmenterModelUrls.POSE_LANDMARKER,
      segmenterModelUrl: PersonSegmenterModelUrls.SELFIE_SEGMENTER,
      maskMaxSide,
    };
    this.worker.postMessage(message);
  }

  private readonly handleMessage = (event: MessageEvent<PersonSegmenterWorkerOutbound>): void => {
    const message = event.data;
    if (message.type === 'ack') {
      this.pending.resolve(message.requestId, undefined);
      return;
    }
    if (message.type === 'pose') {
      this.pending.resolve(message.requestId, message.landmarks);
      return;
    }
    if (message.type === 'mask') {
      const mask: PersonSegmentationMask = {
        t: message.timestamp,
        alpha: message.alpha,
        width: message.width,
        height: message.height,
      };
      this.pending.resolve(message.requestId, mask);
      return;
    }
    if (message.type === 'error') {
      this.pending.reject(message.requestId, new Error(message.message));
    }
  };

  private readonly handleWorkerError = (event: ErrorEvent): void => {
    console.error('[person-segmenter worker] uncaught error', event.message);
    this.pending.rejectAll(new Error(event.message || 'Worker error'));
  };
}
