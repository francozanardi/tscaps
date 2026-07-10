import type { GrayscaleFrame } from '@core/person-segmentation/domain/GrayscaleFrame';
import type { PoseFeatures } from '@core/person-segmentation/domain/PoseFeatures';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import { PersonSegmentationThresholds } from '@core/person-segmentation/domain/PersonSegmentationThresholds';
import type { FrameMotionCalculator } from '@core/person-segmentation/services/FrameMotionCalculator';
import type { GrayscaleDownscaler } from '@core/person-segmentation/services/GrayscaleDownscaler';
import type { LaplacianVarianceCalculator } from '@core/person-segmentation/services/LaplacianVarianceCalculator';
import type { PassingSample, PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import type { PersonBboxCalculator } from '@core/person-segmentation/services/PersonBboxCalculator';
import type { PoseFeatureExtractor } from '@core/person-segmentation/services/PoseFeatureExtractor';
import type { SamplePassEvaluator } from '@core/person-segmentation/services/SamplePassEvaluator';
import type { ShoulderDriftCalculator } from '@core/person-segmentation/services/ShoulderDriftCalculator';
import type { VideoFrameBitmapCapturer } from '@core/person-segmentation/services/VideoFrameBitmapCapturer';
import type { VideoFrameSeeker } from '@core/person-segmentation/services/VideoFrameSeeker';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';

interface PreviousSampleState {
  readonly grayscale: GrayscaleFrame | null;
  readonly features: PoseFeatures | null;
}

/**
 * Walks a video at a fixed sample fps and returns the contiguous time
 * ranges whose frames meet every scene-validity threshold — a visible
 * person of the required visibility, low frame motion, low shoulder
 * drift, and sharp enough content. Each sample runs pose detection
 * through the supplied worker client; blur and motion are measured on
 * the caller's downscaler.
 *
 * Progress is reported through `onFraction` as `[0, 1]` over the
 * video's duration. Aborting the supplied signal stops the walk at
 * the next sample and throws.
 */
export class SceneValidityScanner {

  constructor(
    private readonly seeker: VideoFrameSeeker,
    private readonly capturer: VideoFrameBitmapCapturer,
    private readonly blurCalculator: LaplacianVarianceCalculator,
    private readonly motionCalculator: FrameMotionCalculator,
    private readonly poseExtractor: PoseFeatureExtractor,
    private readonly personBboxCalculator: PersonBboxCalculator,
    private readonly driftCalculator: ShoulderDriftCalculator,
    private readonly evaluator: SamplePassEvaluator,
    private readonly windowFinder: PassingWindowFinder,
    private readonly workerClient: PersonSegmenterWorkerClient,
  ) {}

  async scan(
    video: HTMLVideoElement,
    downscaler: GrayscaleDownscaler,
    sampleFps: number,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<ReadonlyArray<PersonSegmentationWindow>> {
    const duration = video.duration;
    const step = 1 / sampleFps;
    const samples: PassingSample[] = [];
    let previous: PreviousSampleState = { grayscale: null, features: null };
    for (let timestamp = 0; timestamp < duration; timestamp += step) {
      signal.throwIfAborted();
      const evaluated = await this.sampleOne(video, downscaler, timestamp, previous);
      samples.push({ t: timestamp, passes: evaluated.passes });
      previous = { grayscale: evaluated.grayscale, features: evaluated.features };
      onFraction(Math.min(1, (timestamp + step) / duration));
    }
    return this.windowFinder.find(samples, PersonSegmentationThresholds.WINDOW_DURATION_MIN_SEC);
  }

  private async sampleOne(
    video: HTMLVideoElement,
    downscaler: GrayscaleDownscaler,
    timestamp: number,
    previous: PreviousSampleState,
  ): Promise<{ passes: boolean; grayscale: GrayscaleFrame; features: PoseFeatures | null }> {
    await this.seeker.seekTo(video, timestamp);
    const fullGrayscale = downscaler.fullFrame(video);
    const features = await this.detectPose(video, timestamp);
    const personBlur = this.measurePersonBlur(video, downscaler, features);
    const frameBlur = this.blurCalculator.fullFrame(fullGrayscale);
    const frameMotion = this.motionCalculator.meanAbsoluteDifference(fullGrayscale, previous.grayscale);
    const drift = this.driftCalculator.percentBetween(features, previous.features, video.videoWidth, video.videoHeight);
    const passes = this.evaluator.passes({
      features,
      frameBlur,
      personBlur,
      frameMotion,
      shoulderDriftPercent: drift,
    });
    return { passes, grayscale: fullGrayscale, features };
  }

  private async detectPose(video: HTMLVideoElement, timestamp: number): Promise<PoseFeatures | null> {
    const bitmap = await this.capturer.capture(video);
    const landmarks = await this.workerClient.detectPose(bitmap, Math.round(timestamp * 1000));
    return this.poseExtractor.extract(landmarks);
  }

  private measurePersonBlur(
    video: HTMLVideoElement,
    downscaler: GrayscaleDownscaler,
    features: PoseFeatures | null,
  ): number {
    const bbox = this.personBboxCalculator.compute(features);
    if (bbox === null) return 0;
    const sourceX = bbox.minX * video.videoWidth;
    const sourceY = bbox.minY * video.videoHeight;
    const sourceWidth = (bbox.maxX - bbox.minX) * video.videoWidth;
    const sourceHeight = (bbox.maxY - bbox.minY) * video.videoHeight;
    const personGrayscale = downscaler.region(video, sourceX, sourceY, sourceWidth, sourceHeight);
    return this.blurCalculator.fullFrame(personGrayscale);
  }
}
