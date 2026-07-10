import type { PersonSegmenter } from '@core/person-segmentation/domain/PersonSegmenter';
import type { PersonSegmentationOptions } from '@core/person-segmentation/domain/PersonSegmentationOptions';
import type { PersonSegmentationProgress } from '@core/person-segmentation/domain/PersonSegmentationProgress';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { GrayscaleDownscaler } from '@core/person-segmentation/services/GrayscaleDownscaler';
import type { PersonMaskCapturer } from '@core/person-segmentation/infrastructure/PersonMaskCapturer';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';
import type { SceneValidityScanner } from '@core/person-segmentation/infrastructure/SceneValidityScanner';

/**
 * MediaPipe-backed implementation of the person-segmenter contract.
 * Discovers the scene-valid time windows of a video through pose
 * landmarking, then captures actor confidence masks inside those
 * windows through the selfie image segmenter. Both models run in the
 * injected worker client so main-thread rendering stays responsive.
 */
export class MediaPipePersonSegmenter implements PersonSegmenter {

  constructor(
    private readonly workerClient: PersonSegmenterWorkerClient,
    private readonly sceneScanner: SceneValidityScanner,
    private readonly maskCapturer: PersonMaskCapturer,
  ) {}

  async run(
    video: HTMLVideoElement,
    options: PersonSegmentationOptions,
    signal: AbortSignal,
    onProgress: (progress: PersonSegmentationProgress) => void,
  ): Promise<PersonSegmentationResult> {
    await this.workerClient.ensureReady(options.maskMaxSide);
    const downscaler = new GrayscaleDownscaler(options.downscaleWidth, options.downscaleHeight);
    const windows = await this.sceneScanner.scan(
      video,
      downscaler,
      options.sampleFps,
      signal,
      (fraction) => onProgress({ phase: 'scanning', fraction }),
    );
    const maskCache = await this.maskCapturer.capture(
      video,
      windows,
      options.cacheFps,
      signal,
      (fraction) => onProgress({ phase: 'caching-masks', fraction }),
    );
    return { windows, maskCache };
  }
}
