import type { FramePeopleSighting } from '@core/subject-tracking/domain/FramePeopleSighting';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PersonSightingWorkerClient } from '@core/subject-tracking/infrastructure/PersonSightingWorkerClient';

/** Finds the people in one picture with the sighting worker, which is handed a copy: the worker closes what it is sent. */
export class WorkerFramePeopleSighting implements FramePeopleSighting {
  constructor(private readonly worker: PersonSightingWorkerClient) {}

  async sight(picture: ImageBitmap): Promise<ReadonlyArray<PersonSighting>> {
    return this.worker.sight(await createImageBitmap(picture));
  }
}
