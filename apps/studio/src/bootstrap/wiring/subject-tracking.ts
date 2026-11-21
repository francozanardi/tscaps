import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { FindPeopleAction } from '@core/subject-tracking/actions/FindPeopleAction';
import { PlanPersonFollowAction } from '@core/subject-tracking/actions/PlanPersonFollowAction';
import { SightPeopleAction } from '@core/subject-tracking/actions/SightPeopleAction';
import { MediaBunnyFrameSampler } from '@core/subject-tracking/infrastructure/MediaBunnyFrameSampler';
import { MediaPipePersonSightingReader } from '@core/subject-tracking/infrastructure/MediaPipePersonSightingReader';
import type { PersonSightingModelLocations } from '@core/subject-tracking/infrastructure/PersonSightingModelLocations';
import { PersonSightingModelUrls } from '@core/subject-tracking/infrastructure/PersonSightingModelUrls';
import { PersonSightingWorkerClient } from '@core/subject-tracking/infrastructure/PersonSightingWorkerClient';
import { WorkerFramePeopleSighting } from '@core/subject-tracking/infrastructure/WorkerFramePeopleSighting';
import { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';
import { PersonFollowPlanner } from '@core/subject-tracking/services/PersonFollowPlanner';
import { PersonTrackFollower } from '@core/subject-tracking/services/PersonTrackFollower';

export interface SubjectTrackingDependencies {
  readonly editorStore: EditorStore;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  /** Overrides the public CDN, for a host that has to answer offline. */
  readonly modelLocations?: PersonSightingModelLocations;
}

export type SubjectTrackingModule = ReturnType<typeof bootSubjectTracking>;

/**
 * Boots following a person through a stretch of the video: the frame
 * sampler, the MediaPipe sighting worker (created on first use, then
 * kept for the session) and the planner of the crop's path; and finding
 * the people in one picture with the same worker.
 */
export function bootSubjectTracking(deps: SubjectTrackingDependencies) {
  const createWorker = (): Worker => {
    const worker = new Worker(
      new URL('../../core/subject-tracking/infrastructure/workers/personSightingWorker.ts', import.meta.url),
      { type: 'module' },
    );
    deps.workerErrorMonitor.monitor(worker, 'person-sighting-worker');
    return worker;
  };
  const workerClient = new PersonSightingWorkerClient(createWorker, deps.modelLocations ?? PersonSightingModelUrls.DEFAULT, true);
  const sightingReader = new MediaPipePersonSightingReader(new MediaBunnyFrameSampler(), workerClient);
  const followPlanner = new PersonFollowPlanner(new PersonTrackFollower(), new CameraPathPlanner(new HeadFraming()));
  return {
    actions: {
      planFollow: new PlanPersonFollowAction(deps.editorStore, sightingReader, followPlanner),
      findPeople: new FindPeopleAction(deps.editorStore, sightingReader),
      sightPeople: new SightPeopleAction(deps.editorStore, sightingReader),
    },
    services: {
      framePeople: new WorkerFramePeopleSighting(workerClient),
    },
  };
}
