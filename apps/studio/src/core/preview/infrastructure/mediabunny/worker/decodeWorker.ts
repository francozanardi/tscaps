import type {
  ClientToWorkerMessage,
  WorkerToClientMessage,
} from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';
import { DecodeWorkerAudioStreamer } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerAudioStreamer';
import type { DecodeWorkerResponder } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerResponder';
import { DecodeWorkerServer } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerServer';
import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';

new WorkerUncaughtErrorForwarder('decode-worker').install();

const responder: DecodeWorkerResponder = {
  respond(message: WorkerToClientMessage, transferables?: Transferable[]): void {
    if (transferables && transferables.length > 0) {
      self.postMessage(message, { transfer: transferables });
    } else {
      self.postMessage(message);
    }
  },
};

const server = new DecodeWorkerServer(responder, new DecodeWorkerAudioStreamer(responder));

self.onmessage = (event: MessageEvent<ClientToWorkerMessage>): void => {
  server.handle(event.data);
};
