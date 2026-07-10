import { PersonSegmenterWorkerHost } from '@core/person-segmentation/infrastructure/workers/PersonSegmenterWorkerHost';
import { ModuleWorkerImportScriptsShim } from '@core/person-segmentation/infrastructure/workers/ModuleWorkerImportScriptsShim';

self.addEventListener('error', (event: ErrorEvent) => {
  console.error('[person-segmenter worker] uncaught error', event.message, event.filename + ':' + event.lineno, event.error);
});
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('[person-segmenter worker] unhandled rejection', event.reason);
});

new ModuleWorkerImportScriptsShim().install();
new PersonSegmenterWorkerHost().start();
