import { PendingWorkerRequests } from '@core/person-segmentation/infrastructure/PendingWorkerRequests';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PersonSightingModelLocations } from '@core/subject-tracking/infrastructure/PersonSightingModelLocations';
import type {
  PersonSightingWorkerInbound,
  PersonSightingWorkerOutbound,
} from '@core/subject-tracking/infrastructure/workers/PersonSightingWorkerProtocol';

/**
 * Main-thread side of the sighting worker. The worker is created on the
 * first call, so a session that never follows anyone never loads
 * MediaPipe for it; it then lives for the session, until its models
 * lose their GPU context or it is restarted, and the next call starts a
 * new one. The models are loaded once per worker, however many callers
 * wait on them, on the GPU where `onGpu` allows it until a GPU context
 * is lost once, and on the CPU from then on: making new GPU contexts
 * while Safari's GPU process is failing hung the whole page on an iPhone.
 */
export class PersonSightingWorkerClient {
  private readonly pending = new PendingWorkerRequests();
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;

  constructor(
    private readonly createWorker: () => Worker,
    private readonly locations: PersonSightingModelLocations,
    private onGpu: boolean,
  ) {}

  /** Loads the models; a failed load is tried again on the next call. */
  ensureReady(): Promise<void> {
    this.ready ??= this.request<void>((requestId) => ({ type: 'init', requestId, locations: this.locations, onGpu: this.onGpu }))
      .catch((error: unknown) => {
        this.ready = null;
        throw error;
      });
    return this.ready;
  }

  /**
   * The people in `bitmap`, which is handed to the worker and closed
   * there; the models are loaded first where they are not. Rejects where
   * the models lost their GPU context, and the next call starts a new worker.
   */
  async sight(bitmap: ImageBitmap): Promise<ReadonlyArray<PersonSighting>> {
    try {
      await this.ensureReady();
    } catch (error) {
      bitmap.close();
      throw error;
    }
    return this.request((requestId) => ({ type: 'sight', requestId, bitmap }), [bitmap]);
  }

  /** Ends the worker, failing what it was asked; the next call starts a new one and loads the models again. */
  restart(reason: Error = new Error('The person sighting worker was restarted')): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.pending.rejectAll(reason);
  }

  private request<T>(message: (requestId: number) => PersonSightingWorkerInbound, transfer: Transferable[] = []): Promise<T> {
    const requestId = this.pending.reserveId();
    const reply = this.pending.register<T>(requestId);
    this.workerNow().postMessage(message(requestId), transfer);
    return reply;
  }

  private workerNow(): Worker {
    if (this.worker !== null) return this.worker;
    const worker = this.createWorker();
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleWorkerError);
    this.worker = worker;
    return worker;
  }

  private readonly handleMessage = (event: MessageEvent<PersonSightingWorkerOutbound>): void => {
    const message = event.data;
    if (message.type === 'ack') this.pending.resolve(message.requestId, undefined);
    else if (message.type === 'sighted') this.pending.resolve(message.requestId, message.people);
    else if (message.type === 'lost') this.restartOnCpu();
    else this.pending.reject(message.requestId, new Error(message.message));
  };

  private restartOnCpu(): void {
    this.onGpu = false;
    this.restart(new Error('The person sighting models lost their GPU context'));
  }

  private readonly handleWorkerError = (event: ErrorEvent): void => {
    this.restart(new Error(event.message || 'Person sighting worker error'));
  };
}
