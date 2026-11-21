import type { WorkerToClientMessage } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';

/** Where the decode worker's code posts its answers to the client. */
export interface DecodeWorkerResponder {
  /** Posts `message`, handing over the objects in `transferables` instead of copying them. */
  respond(message: WorkerToClientMessage, transferables?: Transferable[]): void;
}
