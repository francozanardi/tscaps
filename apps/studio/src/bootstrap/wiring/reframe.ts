import type { EditorOperationsModule } from '@bootstrap/wiring/editor-operations';
import type { SubjectTrackingModule } from '@bootstrap/wiring/subject-tracking';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ProjectFramePictures } from '@core/export/domain/ProjectFramePictures';
import { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import { NoopRunProfiler } from '@core/person-segmentation/services/NoopRunProfiler';
import { PrefetchingVideoFrameReader } from '@core/person-segmentation/services/PrefetchingVideoFrameReader';
import { ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import { VideoFrameBitmapCapturer } from '@core/person-segmentation/services/VideoFrameBitmapCapturer';
import { VideoFrameSeeker } from '@core/person-segmentation/services/VideoFrameSeeker';
import type { ShotFollowWriter } from '@core/reframe/domain/ShotFollowWriter';
import { CanvasFramingSheetComposer } from '@core/reframe/infrastructure/CanvasFramingSheetComposer';
import { SeekingSourceVideoPictures } from '@core/reframe/infrastructure/SeekingSourceVideoPictures';
import { FramedPartPictures } from '@core/reframe/services/FramedPartPictures';
import { FramedPartWriter } from '@core/reframe/services/FramedPartWriter';
import { PartMoments } from '@core/reframe/services/PartMoments';
import { ReframePartFollower } from '@core/reframe/services/ReframePartFollower';
import { SurveyFraming } from '@core/reframe/services/SurveyFraming';
import { SurveyReframeReadout } from '@core/reframe/services/SurveyReframeReadout';
import { SurveyReframeWorkflow } from '@core/reframe/services/SurveyReframeWorkflow';
import { TakeSpeech } from '@core/reframe/services/TakeSpeech';
import { TakeSurveyPictures } from '@core/reframe/services/TakeSurveyPictures';
import { TakeSurveyor } from '@core/reframe/services/TakeSurveyor';
import { VideoTakes } from '@core/reframe/services/VideoTakes';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import { ShotPictureArea } from '@core/shots/services/ShotPictureArea';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

export interface ReframeDependencies {
  readonly store: EditorStore;
  readonly editorOperations: EditorOperationsModule;
  /** The camera moves, to read what a shot's camera shows. */
  readonly animationCatalog: ElementAnimationCatalog;
  /** Where the video's own picture changes, to find its takes. */
  readonly pictureChanges: PictureChangeReader;
  /** What is said in the video, whatever caption track is shown. */
  readonly originalCaptions: OriginalCaptionTrackReader;
  /** Pictures of the output as the export paints it, for the check. */
  readonly frames: ProjectFramePictures;
  /** Finds the people in the video and follows one, for a framed part whose person moves. */
  readonly subjectTracking: SubjectTrackingModule;
  /** Has a shot's own video follow a person, or stop following one. */
  readonly shotFollows: ShotFollowWriter;
}

export type SurveyReframeModule = ReturnType<typeof bootSurveyReframe>;

/**
 * The reframe by survey: makes the video another shape and frames every
 * shot by measure on the people found in its take, asking nothing but
 * whom a take with several people shows. It serves whoever can look at
 * a picture and answer in one go; `readout` is how its survey and its
 * report read.
 */
export function bootSurveyReframe(deps: ReframeDependencies) {
  const { runner, parser, shotRefs } = deps.editorOperations.services;
  const sheets = new CanvasFramingSheetComposer();
  const moments = new PartMoments(deps.store);
  const speech = new TakeSpeech(deps.store, deps.originalCaptions);
  const workflow = new SurveyReframeWorkflow(
    runner, deps.store, shotRefs, parser, new ShotPictureArea(deps.animationCatalog),
    new VideoTakes(deps.store, deps.pictureChanges),
    new TakeSurveyor(deps.store, deps.subjectTracking.actions.sightPeople),
    new TakeSurveyPictures(bootSourceVideoPictures(deps.store), sheets),
    speech,
    new SurveyFraming(new HeadFraming()),
    new ReframePartFollower(deps.subjectTracking.actions.findPeople, deps.subjectTracking.actions.planFollow, moments, deps.store),
    new FramedPartWriter(runner, deps.store, shotRefs, deps.shotFollows),
    new FramedPartPictures(deps.frames, sheets, moments),
  );
  return { workflow, readout: new SurveyReframeReadout(speech) };
}

/** The source's own pictures, read off an off-screen copy of the video. */
export function bootSourceVideoPictures(store: EditorStore): SeekingSourceVideoPictures {
  return new SeekingSourceVideoPictures(
    store,
    new ScanVideoSourceResolver(),
    new HiddenVideoLoader(),
    new PrefetchingVideoFrameReader(new VideoFrameSeeker(), new VideoFrameBitmapCapturer(), new NoopRunProfiler(), 'agent-source'),
  );
}
