import { FaceDetector, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PersonSightingModelLocations } from '@core/subject-tracking/infrastructure/PersonSightingModelLocations';
import type {
  PersonSightingWorkerInbound,
  PersonSightingWorkerOutbound,
  SightingInitRequest,
  SightRequest,
} from '@core/subject-tracking/infrastructure/workers/PersonSightingWorkerProtocol';
import type { PersonSightingBuilder } from '@core/subject-tracking/services/PersonSightingBuilder';

type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

// Pose finds up to this many people in a frame; a wide shot rarely holds more who matter.
const MAX_PEOPLE = 4;
// WebGL renderers that draw on the CPU: a model on such a "GPU" ran about ten times slower than on the CPU itself.
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software/i;

/**
 * Worker side of the person sighting: loads the pose landmarker and the
 * face detector once, then answers each frame with the people in it,
 * found by their pose, or by their face where no pose shows anyone, as
 * in a close-up the pose landmarker misses. Frames are read one at a
 * time, each on its own (no tracking between frames), since the frames
 * asked about can be a second apart. The models run on the GPU where
 * it can create them, else on the CPU.
 *
 * A model on the GPU whose context is lost (Safari restarts its GPU
 * process under load) goes on answering, wrongly: the same person in
 * the same place in every frame. So once a context is lost, the host
 * answers `lost` to that frame and every later one, and the worker is
 * left for a new one.
 */
export class PersonSightingWorkerHost {
  private pose: PoseLandmarker | null = null;
  private face: FaceDetector | null = null;
  private loading: Promise<void> | null = null;
  private readonly gpuContexts: WebGL2RenderingContext[] = [];
  private softwareRenderer: boolean | null = null;

  constructor(private readonly builder: PersonSightingBuilder) {}

  start(): void {
    self.addEventListener('message', this.handleMessage);
  }

  private readonly handleMessage = (event: MessageEvent<PersonSightingWorkerInbound>): void => {
    const message = event.data;
    if (message.type === 'init') void this.runInit(message);
    else if (message.type === 'sight') this.runSight(message);
  };

  private async runInit(request: SightingInitRequest): Promise<void> {
    try {
      this.loading ??= this.load(request.locations, request.onGpu);
      await this.loading;
      this.reply({ type: 'ack', requestId: request.requestId });
    } catch (error) {
      this.loading = null;
      this.replyError(request.requestId, error);
    }
  }

  private runSight(request: SightRequest): void {
    try {
      const people = this.isContextLost() ? null : this.peopleIn(request.bitmap);
      if (people === null || this.isContextLost()) this.reply({ type: 'lost', requestId: request.requestId });
      else this.reply({ type: 'sighted', requestId: request.requestId, people });
    } catch (error) {
      this.replyError(request.requestId, error);
    } finally {
      request.bitmap.close();
    }
  }

  private isContextLost(): boolean {
    return this.gpuContexts.some((context) => context.isContextLost());
  }

  private peopleIn(bitmap: ImageBitmap): PersonSighting[] {
    if (this.pose === null || this.face === null) throw new Error('The sighting models are not loaded');
    const fromPoses = this.pose.detect(bitmap).landmarks
      .map((landmarks) => this.builder.fromPose(landmarks.map((point) => ({ x: point.x, y: point.y, visibility: point.visibility ?? 1 }))))
      .filter((person): person is PersonSighting => person !== null);
    if (fromPoses.length > 0) return fromPoses;
    return this.face.detect(bitmap).detections
      .flatMap((detection) => (detection.boundingBox === undefined ? [] : [detection.boundingBox]))
      .map((box) => this.builder.fromFace(this.shareOf(box, bitmap)));
  }

  private shareOf(box: { originX: number; originY: number; width: number; height: number }, bitmap: ImageBitmap): NormalizedBbox {
    return {
      minX: box.originX / bitmap.width,
      minY: box.originY / bitmap.height,
      maxX: (box.originX + box.width) / bitmap.width,
      maxY: (box.originY + box.height) / bitmap.height,
    };
  }

  private async load(locations: PersonSightingModelLocations, onGpu: boolean): Promise<void> {
    const fileset = await this.filesetFor(locations);
    this.pose = await this.onGpuElseCpu(onGpu, (delegate, canvas) => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: locations.poseModelUrl, delegate },
      ...(canvas === undefined ? {} : { canvas }),
      runningMode: 'IMAGE',
      numPoses: MAX_PEOPLE,
    }));
    this.face = await this.onGpuElseCpu(onGpu, (delegate, canvas) => FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: locations.faceModelUrl, delegate },
      ...(canvas === undefined ? {} : { canvas }),
      runningMode: 'IMAGE',
    }));
  }

  /** The WebAssembly build this runtime can run; MediaPipe's own resolver expects file names a fingerprinting build does not keep. */
  private async filesetFor(locations: PersonSightingModelLocations): Promise<VisionFileset> {
    const files = (await FilesetResolver.isSimdSupported()) ? locations.wasmSimd : locations.wasmNoSimd;
    return { wasmLoaderPath: files.loaderUrl, wasmBinaryPath: files.binaryUrl };
  }

  /**
   * A model created on the GPU, on a canvas of its own whose context is
   * kept to tell when it is lost, or on the CPU where the GPU is not to
   * be used, cannot create it (no WebGL2 in the worker), or is drawn in
   * software, where the models run several times slower than on the CPU.
   */
  private async onGpuElseCpu<T>(onGpu: boolean, create: (delegate: 'GPU' | 'CPU', canvas: OffscreenCanvas | undefined) => Promise<T>): Promise<T> {
    if (!onGpu || this.drawsInSoftware()) return create('CPU', undefined);
    const canvas = new OffscreenCanvas(1, 1);
    let model: T;
    try {
      model = await create('GPU', canvas);
    } catch {
      return create('CPU', undefined);
    }
    // MediaPipe made a WebGL2 context on the canvas; asking for one again returns that same context.
    const context = canvas.getContext('webgl2');
    if (context !== null) this.gpuContexts.push(context);
    return model;
  }

  /** Whether WebGL here is drawn by a software renderer (SwiftShader, llvmpipe), asked once of a context of its own. */
  private drawsInSoftware(): boolean {
    if (this.softwareRenderer === null) {
      const name = this.rendererName();
      this.softwareRenderer = name !== null && SOFTWARE_RENDERER.test(name);
    }
    return this.softwareRenderer;
  }

  private rendererName(): string | null {
    const context = new OffscreenCanvas(1, 1).getContext('webgl2');
    if (context === null) return null;
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
    const name = String(context.getParameter(debugInfo === null ? context.RENDERER : debugInfo.UNMASKED_RENDERER_WEBGL));
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  }

  private reply(message: PersonSightingWorkerOutbound): void {
    (self as unknown as Worker).postMessage(message);
  }

  private replyError(requestId: number, error: unknown): void {
    this.reply({ type: 'error', requestId, message: error instanceof Error ? error.message : 'Unknown worker error' });
  }
}
