import { OpfsWriterWorkerHost } from '@core/export/infrastructure/workers/OpfsWriterWorkerHost';

self.addEventListener('error', (e: ErrorEvent) => {
  console.error('[opfs writer worker] uncaught error', e.message, e.filename + ':' + e.lineno, e.error);
});
self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  console.error('[opfs writer worker] unhandled rejection', e.reason);
});

new OpfsWriterWorkerHost().start();
