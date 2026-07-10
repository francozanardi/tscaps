import { FilesetResolver, ImageSegmenter, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';
import { MaskDownsampler } from '@core/person-segmentation/services/MaskDownsampler';
import { MonotonicTimestampMapper } from '@core/person-segmentation/infrastructure/workers/MonotonicTimestampMapper';
import type {
  DetectPoseRequest,
  InitRequest,
  PersonSegmenterWorkerInbound,
  PersonSegmenterWorkerOutbound,
  SegmentPersonRequest,
} from '@core/person-segmentation/infrastructure/workers/PersonSegmenterWorkerProtocol';

/**
 * Worker-side counterpart of the main-thread MediaPipe person
 * segmenter. Loads the pose + segmenter models on demand, answers
 * `detect-pose` and `segment-person` requests, and downsamples masks
 * to a bounded resolution before shipping the alpha bytes back.
 *
 * The host outlives individual requests; consecutive requests reuse
 * the loaded MediaPipe instances. `init` is idempotent for the same
 * config — a second call with matching URLs is a no-op.
 */
export class PersonSegmenterWorkerHost {
  private poseLandmarker: PoseLandmarker | null = null;
  private imageSegmenter: ImageSegmenter | null = null;
  private poseTimestamps = new MonotonicTimestampMapper();
  private segmenterTimestamps = new MonotonicTimestampMapper();
  private maskDownsampler: MaskDownsampler | null = null;
  private currentInitKey: string | null = null;

  start(): void {
    self.addEventListener('message', this.handleMessage);
  }

  private readonly handleMessage = (event: MessageEvent<PersonSegmenterWorkerInbound>): void => {
    const message = event.data;
    if (message.type === 'init') void this.runInit(message);
    else if (message.type === 'detect-pose') void this.runPoseDetection(message);
    else if (message.type === 'segment-person') void this.runPersonSegmentation(message);
  };

  private async runInit(request: InitRequest): Promise<void> {
    try {
      await this.ensureLoaded(request);
      this.reply({ type: 'ack', requestId: request.requestId });
    } catch (error) {
      this.replyError(request.requestId, error);
    }
  }

  private async runPoseDetection(request: DetectPoseRequest): Promise<void> {
    try {
      const landmarker = this.requirePoseLandmarker();
      const result = landmarker.detectForVideo(request.bitmap, this.poseTimestamps.next(request.timestampMs));
      const landmarks = this.serializeLandmarks(result.landmarks[0] ?? []);
      request.bitmap.close();
      this.reply({ type: 'pose', requestId: request.requestId, landmarks });
    } catch (error) {
      request.bitmap.close();
      this.replyError(request.requestId, error);
    }
  }

  private async runPersonSegmentation(request: SegmentPersonRequest): Promise<void> {
    try {
      const segmenter = this.requireSegmenter();
      const downsampler = this.requireDownsampler();
      const result = segmenter.segmentForVideo(request.bitmap, this.segmenterTimestamps.next(request.timestampMs));
      const mask = result.confidenceMasks?.[0];
      if (mask === undefined) {
        request.bitmap.close();
        this.replyError(request.requestId, new Error('Segmenter returned no confidence mask'));
        return;
      }
      const confidence = mask.getAsFloat32Array();
      const sourceWidth = mask.width;
      const sourceHeight = mask.height;
      mask.close();
      request.bitmap.close();
      const downsampled = downsampler.downsample(confidence, sourceWidth, sourceHeight, request.timestampSec);
      this.reply(
        {
          type: 'mask',
          requestId: request.requestId,
          timestamp: downsampled.t,
          alpha: downsampled.alpha,
          width: downsampled.width,
          height: downsampled.height,
        },
        [downsampled.alpha.buffer],
      );
    } catch (error) {
      request.bitmap.close();
      this.replyError(request.requestId, error);
    }
  }

  private async ensureLoaded(request: InitRequest): Promise<void> {
    const key = `${request.wasmPath}|${request.poseModelUrl}|${request.segmenterModelUrl}|${request.maskMaxSide}`;
    if (this.currentInitKey === key) return;
    const vision = await FilesetResolver.forVisionTasks(request.wasmPath);
    this.disposeCurrent();
    this.poseLandmarker = await this.createPoseLandmarker(vision, request.poseModelUrl);
    this.imageSegmenter = await this.createImageSegmenter(vision, request.segmenterModelUrl);
    this.maskDownsampler = new MaskDownsampler(request.maskMaxSide);
    this.currentInitKey = key;
  }

  private createPoseLandmarker(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, modelUrl: string): Promise<PoseLandmarker> {
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  private createImageSegmenter(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, modelUrl: string): Promise<ImageSegmenter> {
    return ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  }

  private disposeCurrent(): void {
    this.poseLandmarker?.close();
    this.imageSegmenter?.close();
    this.poseLandmarker = null;
    this.imageSegmenter = null;
    this.poseTimestamps = new MonotonicTimestampMapper();
    this.segmenterTimestamps = new MonotonicTimestampMapper();
    this.maskDownsampler = null;
    this.currentInitKey = null;
  }

  private serializeLandmarks(landmarks: ReadonlyArray<{ x: number; y: number; visibility?: number }>): ReadonlyArray<PoseLandmark> {
    return landmarks.map((point) => ({ x: point.x, y: point.y, visibility: point.visibility ?? 1 }));
  }

  private requirePoseLandmarker(): PoseLandmarker {
    if (this.poseLandmarker === null) throw new Error('Pose landmarker is not initialised');
    return this.poseLandmarker;
  }

  private requireSegmenter(): ImageSegmenter {
    if (this.imageSegmenter === null) throw new Error('Image segmenter is not initialised');
    return this.imageSegmenter;
  }

  private requireDownsampler(): MaskDownsampler {
    if (this.maskDownsampler === null) throw new Error('Mask downsampler is not initialised');
    return this.maskDownsampler;
  }

  private reply(message: PersonSegmenterWorkerOutbound, transfer?: Transferable[]): void {
    (self as unknown as Worker).postMessage(message, transfer ?? []);
  }

  private replyError(requestId: number, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    this.reply({ type: 'error', requestId, message });
  }
}
