import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';
import { MediaPipeWorkerDocumentShim } from '@core/person-segmentation/infrastructure/workers/MediaPipeWorkerDocumentShim';
import { ModuleWorkerImportScriptsShim } from '@core/person-segmentation/infrastructure/workers/ModuleWorkerImportScriptsShim';
import { PersonSightingWorkerHost } from '@core/subject-tracking/infrastructure/workers/PersonSightingWorkerHost';
import { PersonSightingBuilder } from '@core/subject-tracking/services/PersonSightingBuilder';

new WorkerUncaughtErrorForwarder('person-sighting-worker').install();

new ModuleWorkerImportScriptsShim().install();
new MediaPipeWorkerDocumentShim().install();
new PersonSightingWorkerHost(new PersonSightingBuilder()).start();
