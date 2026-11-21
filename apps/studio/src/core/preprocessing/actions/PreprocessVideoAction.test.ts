import type { AssignCaptionModesAction } from '@core/caption-modes/actions/AssignCaptionModesAction';
import { Document, Section, Segment, Line, Word, TimeFragment, type UntranscribedRegion } from '@tscaps/engine';
import { UntranscribedRegionsStore } from '@core/transcription/store/UntranscribedRegionsStore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import { PreprocessingRunsStore } from '@core/preprocessing/store/PreprocessingRunsStore';
import { EditorStore } from '@core/editor/store/EditorStore';
import { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import { LanguageCanonicalCodeResolver } from '@core/preprocessing/services/LanguageCanonicalCodeResolver';
import type { AppError } from '@core/errors/domain/AppError';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type {
  TranscriptionAudioLengthCap,
  TranscriptionAudioLengthPolicy,
} from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { ReadSubtitleFileAction } from '@core/transcription/actions/ReadSubtitleFileAction';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { ApplyTextDirectionAction } from '@core/preprocessing/actions/ApplyTextDirectionAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ProjectFromEditorStateBuilder } from '@core/projects/services/ProjectFromEditorStateBuilder';
import type { ProjectSerializer } from '@core/projects/services/ProjectSerializer';
import type { Project } from '@core/projects/domain/Project';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';
import type {
  PreviewProxyResolution,
  PreviewProxyResolver,
} from '@core/preview/services/PreviewProxyResolver';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';
import { PreviewProxyStage } from '@core/preprocessing/services/PreviewProxyStage';
import { PreprocessPersistence } from '@core/preprocessing/services/PreprocessPersistence';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import { HandedOffVideoFiles } from '@core/videos/services/HandedOffVideoFiles';
import { ReleaseHandedOffVideoAction } from '@core/videos/actions/ReleaseHandedOffVideoAction';
import { PreprocessingTelemetryReporter } from '@core/preprocessing/services/PreprocessingTelemetryReporter';
import type { VisibilitySpan } from '@core/_shared/domain/VisibilityTracker';
import { CompositeVideoValidator } from '@core/videos/services/CompositeVideoValidator';
import { VideoRejectionResolver } from '@core/preprocessing/services/VideoRejectionResolver';
import { DurationVideoValidator } from '@core/transcription/services/DurationVideoValidator';
import { ReadableVideoValidator } from '@core/videos/services/ReadableVideoValidator';
import { SourceVideoAdmission } from '@core/preprocessing/services/SourceVideoAdmission';
import { VideoConversionOfferCoordinator } from '@core/preprocessing/services/VideoConversionOfferCoordinator';
import { VideoConversionOfferStore } from '@core/preprocessing/store/VideoConversionOfferStore';
import { VideoConversionTelemetryReporter } from '@core/preprocessing/services/VideoConversionTelemetryReporter';
import { AcceptVideoConversionAction } from '@core/preprocessing/actions/AcceptVideoConversionAction';
import { DeclineVideoConversionAction } from '@core/preprocessing/actions/DeclineVideoConversionAction';
import { VideoConversionAvailability } from '@core/videos/services/VideoConversionAvailability';
import { VideoConversionMemoryRisk } from '@core/videos/services/VideoConversionMemoryRisk';
import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type { VideoConversionEstimate, VideoConverter } from '@core/videos/domain/VideoConverter';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';
import { VideoConversionFailedError } from '@core/videos/domain/errors/VideoConversionFailedError';

/**
 * These cover the orchestration promises of the pipeline: what
 * survives a failure, what is allowed to run before the duration cap
 * is checked, and when a proxy is durable enough to keep. The
 * document the passes derive is not the subject — those actions own
 * their own behaviour and are stubbed here so the run reaches its
 * interesting parts.
 */

class RecordingTelemetry implements Telemetry {
  readonly captured: { name: string; properties: TelemetryEventProperties }[] = [];

  capture(event: TelemetryEventName, properties?: TelemetryEventProperties): void {
    this.captured.push({ name: event, properties: properties ?? {} });
  }

  names(): string[] {
    return this.captured.map((entry) => entry.name);
  }

  propertiesOf(name: string): TelemetryEventProperties | undefined {
    return this.captured.find((entry) => entry.name === name)?.properties;
  }

  allPropertiesOf(name: string): TelemetryEventProperties[] {
    return this.captured.filter((entry) => entry.name === name).map((entry) => entry.properties);
  }
}

class RecordingFailureReporter {
  readonly reported: AppError[] = [];

  report(cause: unknown): void {
    this.reported.push(cause as AppError);
  }

  names(): string[] {
    return this.reported.map((error) => error.name);
  }
}

class InMemoryPreviewProxyRepository implements PreviewProxyRepository {
  private readonly stored = new Map<string, PreviewProxy>();

  async load(projectId: string): Promise<PreviewProxy | null> {
    return this.stored.get(projectId) ?? null;
  }

  async store(projectId: string, proxy: PreviewProxy): Promise<void> {
    this.stored.set(projectId, proxy);
  }

  async delete(projectId: string): Promise<void> {
    this.stored.delete(projectId);
  }

  count(): number {
    return this.stored.size;
  }
}

class UncappedAudioLength implements TranscriptionAudioLengthPolicy {
  resolveCap(): Promise<TranscriptionAudioLengthCap> {
    return Promise.resolve({ state: 'no-cap' });
  }
}

class CappedAudioLength implements TranscriptionAudioLengthPolicy {
  constructor(private readonly seconds: number) {}

  resolveCap(): Promise<TranscriptionAudioLengthCap> {
    return Promise.resolve({ state: 'has-cap', seconds: this.seconds });
  }
}

/**
 * Keeps every project saved into it, and holds each project's first
 * save open until the test finishes that project's upload — the window
 * in which a project's video is still going up to a server. Later saves
 * of the same project wait their turn behind it, as a repository that
 * uploads makes them. A project saved before the test began has its
 * video up already, and a save of it lands at once.
 */
class UploadingProjectRepository implements ProjectRepository {
  private readonly saved = new Map<string, Project>();
  private readonly uploadedBefore = new Set<string>();
  private readonly saveQueues = new Map<string, Promise<void>>();
  private readonly pendingUploads = new Map<string, () => void>();

  save(project: Project): Promise<void> {
    const queued = this.saveQueues.get(project.id);
    const next = queued
      ? queued.then(() => this.keep(project))
      : this.firstSave(project);
    this.saveQueues.set(project.id, next);
    return next;
  }

  /** Declares a project saved before the test began, with its video on the server. */
  holdSavedEarlier(projectId: string): void {
    this.uploadedBefore.add(projectId);
  }

  finishUpload(projectId: string): void {
    this.pendingUploads.get(projectId)?.();
    this.pendingUploads.delete(projectId);
  }

  isUploading(projectId: string): boolean {
    return this.pendingUploads.has(projectId);
  }

  wordsSavedFor(projectId: string): string[] | null {
    const document = this.saved.get(projectId)?.document ?? null;
    return document ? document.getWords().map((word) => word.text) : null;
  }

  list(): Promise<ProjectMetadata[]> {
    return Promise.resolve([]);
  }

  load(): Promise<Project | null> {
    return Promise.resolve(null);
  }

  has(id: string): Promise<boolean> {
    return Promise.resolve(this.saved.has(id));
  }

  delete(id: string): Promise<void> {
    this.saved.delete(id);
    return Promise.resolve();
  }

  hasVideoSource(): Promise<boolean> {
    return Promise.resolve(false);
  }

  loadVideoBlob(): Promise<VideoBlobLookup> {
    return Promise.resolve({ outcome: 'missing', reason: 'remote-provider-absent' });
  }

  cacheVideoBlob(): Promise<void> {
    return Promise.resolve();
  }

  private firstSave(project: Project): Promise<void> {
    if (this.uploadedBefore.has(project.id)) return Promise.resolve().then(() => this.keep(project));
    const upload = new Promise<void>((resolve) => this.pendingUploads.set(project.id, resolve));
    return upload.then(() => this.keep(project));
  }

  private keep(project: Project): void {
    this.saved.set(project.id, project);
  }
}

/** A clock the test moves by hand, read through `performance.now()`. */
class ManualClock {
  private nowMs = 0;

  now(): number {
    return this.nowMs;
  }

  advance(ms: number): void {
    this.nowMs += ms;
  }
}

/** Decodes everything except the codecs it is told the browser lacks, named on the file's type. */
class CodecRefusingCompatibilityChecker implements VideoCompatibilityChecker {
  constructor(private readonly refusedCodecs: ReadonlyMap<string, string>) {}

  async check(source: Blob): Promise<void> {
    const codec = this.refusedCodecs.get(source.type);
    if (codec) throw new UnsupportedVideoCodecError({ codec });
  }
}

/** Converts any source into a fixed MP4, or fails the way it is told to. */
class FixedOutputVideoConverter implements VideoConverter {
  readonly converted: string[] = [];
  readonly stopped: string[] = [];
  converting = false;

  constructor(
    private readonly failure: Error | null,
    private readonly decodedPixels: number,
    private readonly runsUntilStopped: boolean,
  ) {}

  async estimate(): Promise<VideoConversionEstimate | null> {
    return { seconds: 95, decodedPixels: this.decodedPixels };
  }

  async convert(source: File, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<File> {
    onProgress(0.5);
    if (this.failure) throw new VideoConversionFailedError({ cause: this.failure });
    if (this.runsUntilStopped) await this.untilStopped(source, signal);
    this.converted.push(source.name);
    onProgress(1);
    return new File(['converted'], 'clip.mp4', { type: 'video/mp4' });
  }

  /** Keeps converting until `signal` aborts, then rejects with what stopped it, as a converter does. */
  private untilStopped(source: File, signal: AbortSignal): Promise<never> {
    this.converting = true;
    return new Promise<never>((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        this.converting = false;
        this.stopped.push(source.name);
        reject(signal.reason);
      }, { once: true });
    });
  }
}

/** Answers every offer the moment it is made, the way the reader would through the dialog, and keeps what it was shown. */
class AnsweringReader {
  readonly offersSeen: VideoConversionOffer[] = [];

  constructor(
    private readonly offerStore: VideoConversionOfferStore,
    private readonly accept: AcceptVideoConversionAction,
    private readonly decline: DeclineVideoConversionAction,
  ) {}

  answerWith(accepted: boolean): void {
    this.offerStore.addEventListener('change', () => {
      const offer = this.offerStore.offer;
      if (offer === null) return;
      this.offersSeen.push(offer);
      if (accepted) this.accept.execute();
      else this.decline.execute();
    });
  }
}

/** Every pixel of every frame of a minute of portrait 1080p at 30 frames a second. */
const A_MINUTE_OF_PORTRAIT_1080P = 1080 * 1920 * 30 * 60;
/** The same for five seconds. */
const FIVE_SECONDS_OF_PORTRAIT_1080P = 1080 * 1920 * 30 * 5;

const PROXY: PreviewProxy = {
  blob: new Blob(['proxy']),
  mimeType: 'video/mp4',
  widthPx: 640,
  heightPx: 360,
};

/** Lets queued work run until `condition` holds; fails when it never does. */
async function until(condition: () => boolean): Promise<void> {
  for (let tick = 0; tick < 500; tick++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('The awaited condition never held');
}

function metadataWith(patch: Partial<VideoSourceMetadata>): VideoSourceMetadata {
  return {
    mimeType: 'video/mp4',
    sourceReadable: true,
    containerFormat: 'mp4',
    durationSeconds: 30,
    videoCodec: 'avc1',
    videoWidthPx: 1920,
    videoHeightPx: 1080,
    hasAudioTrack: true,
    audioCodec: 'aac',
    audioSampleRate: 48_000,
    audioChannels: 2,
    ...patch,
  };
}

function documentWithOneWord(): Document {
  return documentSaying('hola');
}

function documentSaying(text: string): Document {
  return new Document({
    sections: [
      new Section({
        segments: [
          new Segment({
            lines: [new Line({ words: [new Word({ text, time: new TimeFragment(0, 1) })] })],
          }),
        ],
        kind: '',
      }),
    ],
  });
}

/**
 * Assembles the action with controllable collaborators. Everything a
 * test wants to steer is exposed on the returned harness; everything
 * else is inert.
 */
function buildHarness(overrides: {
  readonly audioLengthPolicy?: TranscriptionAudioLengthPolicy;
  /** `call` counts the transcriptions started so far, this one included. */
  readonly transcribe?: (call: number, progress: PreprocessingProgressStore) => Promise<Document>;
  /** What a transcription left untranscribed, by the same count; nothing when absent. */
  readonly untranscribedRegions?: (call: number) => UntranscribedRegion[];
  readonly resolveProxy?: () => Promise<PreviewProxyResolution>;
  readonly saveProject?: () => Promise<void>;
  /** Saves projects through the real save action into this repository instead. */
  readonly projects?: ProjectRepository;
  /** Runs before a new project's identity is stamped, once its copy is written. */
  readonly projectCopyWritten?: () => Promise<void>;
  readonly runTaggers?: () => Promise<void>;
  readonly videoStoreFailure?: unknown;
  readonly videoIsUploaded?: boolean;
  readonly canPersist?: boolean;
  readonly previewProxyEnabled?: boolean;
  readonly transcribesOnDevice?: boolean;
  readonly refusedCodecs?: ReadonlyMap<string, string>;
  readonly browserKeepsDecodedFrames?: boolean;
  readonly decodedPixels?: number;
  readonly conversionFailure?: Error;
  /** The accepted conversion runs until the run stops it. */
  readonly conversionRunsUntilStopped?: boolean;
  readonly exportSupported?: boolean;
  readonly metadata?: VideoSourceMetadata;
  readonly visibility?: Omit<VisibilitySpan, 'end'>;
  /** What this device keeps of the run's video once its copy is written; nothing when absent. */
  readonly keptCopy?: VideoBlobLookup;
} = {}) {
  const store = new EditorStore();
  const progressStore = new PreprocessingProgressStore();
  const runsStore = new PreprocessingRunsStore();
  const untranscribedRegionsStore = new UntranscribedRegionsStore();
  const telemetry = new RecordingTelemetry();
  const proxyRepository = new InMemoryPreviewProxyRepository();
  const passesRun: string[] = [];
  const passesRunOnStore: { readonly name: string; readonly store: EditorStore }[] = [];
  const saveFailures = new RecordingFailureReporter();
  const videoStoreFailures = new RecordingFailureReporter();
  let transcribeCalls = 0;
  const transcriptionProjects: (string | null)[] = [];
  const subtitleFilesRead: string[] = [];
  let proxyResolveCalls = 0;

  // The pipeline's collaborators are concrete action classes with no
  // port to implement, so a stub stands in structurally. Each is
  // named after what it replaces rather than cast to `never`.
  const substitute = <T>(stub: object): T => stub as T;

  const transcribedFiles: File[] = [];
  const compatibilityChecker = new CodecRefusingCompatibilityChecker(overrides.refusedCodecs ?? new Map());
  const converter = new FixedOutputVideoConverter(
    overrides.conversionFailure ?? null,
    overrides.decodedPixels ?? FIVE_SECONDS_OF_PORTRAIT_1080P,
    overrides.conversionRunsUntilStopped ?? false,
  );
  const offerStore = new VideoConversionOfferStore();
  const offerCoordinator = new VideoConversionOfferCoordinator(offerStore);
  const reader = new AnsweringReader(
    offerStore,
    new AcceptVideoConversionAction(offerCoordinator),
    new DeclineVideoConversionAction(offerCoordinator),
  );
  const errorDescriber = substitute<AppErrorTelemetryDescriber>({
    describe: (error: AppError) => ({ error_name: error.name }),
  });

  const recordPass = (name: string, store: EditorStore) => {
    passesRun.push(name);
    passesRunOnStore.push({ name, store });
  };
  const recordingPass = (name: string) => ({
    execute: (store: EditorStore) => recordPass(name, store),
  });

  const keeper = substitute<OriginalVideoKeeper>({
    keep: async () => overrides.videoStoreFailure ?? null,
    copyOnThisDevice: async () => overrides.keptCopy ?? { outcome: 'missing', reason: 'absent' },
  });
  const handedOffFiles = new HandedOffVideoFiles();

  let projectsCreated = 0;
  let projectIdsPicked = 0;
  const saveProject = overrides.projects
    ? new SaveProjectAction(
      store,
      overrides.projects,
      new ProjectFromEditorStateBuilder(),
      substitute<ProjectSerializer>({
        serialize: (project: Project) => ({
          id: project.id,
          words: project.document?.getWords().map((word) => word.text) ?? null,
        }),
      }),
    )
    : substitute<SaveProjectAction>({ execute: overrides.saveProject ?? (async () => undefined) });

  const action = new PreprocessVideoAction(
    store,
    substitute<TranscribeAction>({
      execute: async (file: File, _preference: TranscribePreference, requester: TranscriptionRequester) => {
        transcribeCalls++;
        transcribedFiles.push(file);
        transcriptionProjects.push(requester.projectId);
        const call = transcribeCalls;
        const document = await (overrides.transcribe ?? (async () => documentWithOneWord()))(call, requester.progress);
        return { document, untranscribedRegions: overrides.untranscribedRegions?.(call) ?? [] };
      },
    }),
    untranscribedRegionsStore,
    substitute<ReadSubtitleFileAction>({
      execute: async (file: SubtitleFile) => {
        subtitleFilesRead.push(file.name);
        return documentWithOneWord();
      },
    }),
    substitute<RunTaggersAction>({
      execute: async (store: EditorStore) => {
        recordPass('taggers', store);
        await overrides.runTaggers?.();
      },
    }),
    substitute<ApplyMultipleSpeakersAction>(recordingPass('multipleSpeakers')),
    substitute<ApplyTextDirectionAction>(recordingPass('textDirection')),
    substitute<AssignCaptionModesAction>(recordingPass('captionModes')),
    substitute<RefreshDocumentAction>(recordingPass('refresh')),
    new PreviewProxyStage(
      store,
      substitute<PreviewProxyResolver>({
        fromSource: async () => {
          proxyResolveCalls++;
          return (overrides.resolveProxy
            ?? (async () => ({
              preview: { kind: 'proxy' as const, file: new Blob(['preview']) },
              freshProxy: PROXY,
            })))();
        },
      }),
      proxyRepository,
      'sequential-after-transcribe',
      overrides.previewProxyEnabled ?? true,
    ),
    new PreprocessPersistence(
      substitute<CreateProjectAction>({
        execute: async (projectId: string, sessionStore: () => EditorStore) => {
          await overrides.projectCopyWritten?.();
          projectsCreated++;
          sessionStore().patch({
            projectId,
            projectName: `Project ${projectsCreated}`,
            projectCreatedAt: new Date(),
          });
          return { videoStoreFailure: overrides.videoStoreFailure ?? null };
        },
      }),
      saveProject,
      keeper,
      () => overrides.canPersist ?? true,
      () => `project-${++projectIdsPicked}`,
      substitute<NonBlockingFailureReporter>(saveFailures),
      substitute<NonBlockingFailureReporter>(videoStoreFailures),
      overrides.videoIsUploaded ?? false,
    ),
    new SourceVideoAdmission(
      compatibilityChecker,
      new VideoConversionAvailability(),
      new VideoConversionMemoryRisk(overrides.browserKeepsDecodedFrames ?? false),
      converter,
      offerCoordinator,
      new VideoConversionTelemetryReporter(telemetry, errorDescriber, 'local'),
    ),
    { isSupported: async () => overrides.exportSupported ?? true },
    new VideoRejectionResolver(
      store,
      new CompositeVideoValidator([
        new ReadableVideoValidator(),
        new DurationVideoValidator(overrides.audioLengthPolicy ?? new UncappedAudioLength()),
      ]),
      new AppErrorClassifier(),
    ),
    progressStore,
    new PreprocessingTelemetryReporter(
      store,
      telemetry,
      errorDescriber,
      'local',
      overrides.transcribesOnDevice ?? true,
    ),
    { probe: async () => overrides.metadata ?? metadataWith({}) },
    new AppErrorClassifier(),
    substitute<StoragePersistence>({ ensure: async () => true }),
    new LanguageCanonicalCodeResolver(),
    {
      begin: () => ({
        ...(overrides.visibility ?? { wasHidden: false, currentState: 'visible' }),
        end: () => undefined,
      }),
    },
    runsStore,
    new ReleaseHandedOffVideoAction(store, handedOffFiles, keeper),
  );

  return {
    action,
    handedOffFiles,
    store,
    progressStore,
    runsStore,
    untranscribedRegionsStore,
    telemetry,
    proxyRepository,
    passesRun,
    /** The passes run on `store`, in order. */
    passesRunOn: (store: EditorStore) => passesRunOnStore
      .filter((pass) => pass.store === store)
      .map((pass) => pass.name),
    saveFailures,
    videoStoreFailures,
    reader,
    offerStore,
    converter,
    transcribeCalls: () => transcribeCalls,
    /** The project each transcription was asked for, in order. */
    transcriptionProjects: () => [...transcriptionProjects],
    projectsCreated: () => projectsCreated,
    transcribedFiles: () => [...transcribedFiles],
    subtitleFilesRead: () => [...subtitleFilesRead],
    proxyResolveCalls: () => proxyResolveCalls,
  };
}

describe('PreprocessVideoAction', () => {
  beforeEach(() => {
    // `execute` yields one paint before the heavy work; Node has no
    // rendering loop to yield to.
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0) as unknown as number) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    vi.restoreAllMocks();
  });

  function seedVideo(store: EditorStore): void {
    store.patchVideo({ file: new File(['video'], 'clip.mp4', { type: 'video/mp4' }), duration: 30 });
  }

  /** Opens a video the way the editor does: a fresh session around the new file. */
  function openVideo(store: EditorStore, name: string): File {
    const file = new File([name], name, { type: 'video/mp4' });
    store.reset({ video: { file, fileName: name, mimeType: file.type, size: file.size, duration: 30 } });
    return file;
  }

  /**
   * The reader opens a second video while the first one's project is
   * still uploading, as happens after leaving the editor through the
   * browser's back button. The first upload ends before the second.
   * Resolves once both runs are over.
   */
  async function openSecondVideoWhileFirstUploads(
    harness: ReturnType<typeof buildHarness>,
    projects: UploadingProjectRepository,
  ): Promise<void> {
    openVideo(harness.store, 'first.mp4');
    const firstRun = harness.action.execute({ multipleSpeakers: false });
    await until(() => harness.passesRun.includes('refresh'));

    openVideo(harness.store, 'second.mp4');
    const secondRun = harness.action.execute({ multipleSpeakers: false });
    await until(() => projects.isUploading('project-2'));

    projects.finishUpload('project-1');
    projects.finishUpload('project-2');
    await Promise.all([firstRun, secondRun]);
  }

  it('rejects an over-cap video before spending any work on it', async () => {
    const harness = buildHarness({ audioLengthPolicy: new CappedAudioLength(10) });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.store.snapshot().error).not.toBeNull();
    expect(harness.store.snapshot().status).not.toBe('preprocessing');
    expect(harness.transcribeCalls()).toBe(0);
    expect(harness.proxyResolveCalls()).toBe(0);
    // No dialog gates this entry point, so the run reports it.
    expect(harness.telemetry.names()).toEqual([]);
  });

  it('leaves the editor usable when transcription fails', async () => {
    const harness = buildHarness({
      transcribe: async () => {
        throw new Error('transcriber exploded');
      },
    });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.store.snapshot().status).toBe('idle');
    expect(harness.store.snapshot().error).not.toBeNull();
    expect(harness.telemetry.names()).toEqual(['preprocessing_started', 'preprocessing_failed']);
  });

  it('marks a failure that came after the page was hidden', async () => {
    const harness = buildHarness({
      transcribe: async () => {
        throw new TypeError('Load failed');
      },
      visibility: { wasHidden: true, currentState: 'hidden' },
    });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.telemetry.propertiesOf('preprocessing_failed')).toMatchObject({
      was_hidden: true,
      visibility_state: 'hidden',
    });
  });

  it('does not keep a proxy the project row cannot point at', async () => {
    const harness = buildHarness({
      saveProject: async () => {
        throw new Error('disk full');
      },
    });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.proxyRepository.count()).toBe(0);
  });

  it('finishes the run even when the project cannot be saved', async () => {
    const harness = buildHarness({
      saveProject: async () => {
        throw new Error('disk full');
      },
    });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.telemetry.names()).toEqual(['preprocessing_started', 'preprocessing_completed']);
    expect(harness.store.snapshot().error).toBeNull();
  });

  it('says nothing about the video when the project itself was not saved', async () => {
    const harness = buildHarness({
      videoStoreFailure: new Error('disk full'),
      saveProject: async () => {
        throw new Error('disk full');
      },
    });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.saveFailures.reported).toHaveLength(1);
    expect(harness.videoStoreFailures.names()).toEqual([]);
  });

  it('reports a video the device would not keep once the project is saved', async () => {
    const harness = buildHarness({ videoStoreFailure: new Error('disk full') });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.videoStoreFailures.names()).toEqual(['ProjectVideoStoreFailedError']);
    expect(harness.saveFailures.names()).toEqual([]);
  });

  it('says nothing when a run that will not save a project could not keep the video either', async () => {
    const harness = buildHarness({ canPersist: false, videoStoreFailure: new Error('disk full') });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.videoStoreFailures.names()).toEqual([]);
    expect(harness.saveFailures.names()).toEqual([]);
  });

  it('says nothing when the video was kept', async () => {
    const harness = buildHarness();
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.videoStoreFailures.names()).toEqual([]);
  });

  it('keeps the freshly encoded proxy once the project row is durable', async () => {
    const harness = buildHarness();
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.proxyRepository.count()).toBe(1);
    expect(await harness.proxyRepository.load('project-1')).toEqual(PROXY);
  });

  describe('a video a landing handed over', () => {
    const keptOnThisDevice = (): VideoBlobLookup => ({ outcome: 'found', blob: new Blob(['kept']), source: 'device' });

    it('is let go of for the copy this device keeps once the run is over, by the preview playing it too', async () => {
      const harness = buildHarness({ keptCopy: keptOnThisDevice(), previewProxyEnabled: false });
      const handedOff = openVideo(harness.store, 'handed.mp4');
      harness.handedOffFiles.remember(handedOff);

      await harness.action.execute({ multipleSpeakers: false });

      const { video } = harness.store.snapshot();
      expect(video.file).not.toBe(handedOff);
      expect(video.file?.name).toBe('handed.mp4');
      expect(await video.file?.text()).toBe('kept');
      expect(video.preview).toMatchObject({ kind: 'original', file: video.file });
    });

    it('leaves a proxy preview where it is', async () => {
      const harness = buildHarness({ keptCopy: keptOnThisDevice() });
      const handedOff = openVideo(harness.store, 'handed.mp4');
      harness.handedOffFiles.remember(handedOff);

      await harness.action.execute({ multipleSpeakers: false });

      const { video } = harness.store.snapshot();
      expect(video.file).not.toBe(handedOff);
      expect(video.preview?.kind).toBe('proxy');
    });

    it('is still read when this device holds it only in memory, which is the handed-over file itself', async () => {
      const handedOff = new File(['handed'], 'handed.mp4', { type: 'video/mp4' });
      const harness = buildHarness({ keptCopy: { outcome: 'found', blob: handedOff, source: 'memory' } });
      harness.store.reset({ video: { file: handedOff, fileName: handedOff.name, mimeType: handedOff.type, size: handedOff.size, duration: 30 } });
      harness.handedOffFiles.remember(handedOff);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.store.snapshot().video.file).toBe(handedOff);
    });

    it('is still read when this device kept no copy of it', async () => {
      const harness = buildHarness({ previewProxyEnabled: false });
      const handedOff = openVideo(harness.store, 'handed.mp4');
      harness.handedOffFiles.remember(handedOff);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.store.snapshot().video.file).toBe(handedOff);
    });
  });

  it('keeps reading a video chosen in the editor, which no landing handed over', async () => {
    const harness = buildHarness({ keptCopy: { outcome: 'found', blob: new Blob(['kept']), source: 'device' } });
    const chosen = openVideo(harness.store, 'chosen.mp4');

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.store.snapshot().video.file).toBe(chosen);
  });

  it('opens the editor without transcribing when the source has no audio track', async () => {
    const harness = buildHarness({ metadata: metadataWith({ hasAudioTrack: false }) });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.transcribeCalls()).toBe(0);
    expect(harness.telemetry.names()).toContain('preprocessing_completed');
    expect(harness.store.snapshot().error).toBeNull();
  });

  it('takes the captions from a subtitle file instead of transcribing, even without an audio track', async () => {
    const harness = buildHarness({ metadata: metadataWith({ hasAudioTrack: false }) });
    seedVideo(harness.store);

    await harness.action.execute({
      multipleSpeakers: false,
      subtitleFile: { name: 'talk.srt', text: '1\n00:00:01,000 --> 00:00:02,000\nHello\n' },
    });

    expect(harness.transcribeCalls()).toBe(0);
    expect(harness.subtitleFilesRead()).toEqual(['talk.srt']);
    expect(harness.store.snapshot().document?.getWords()).toHaveLength(1);
  });

  it('reports the on-device model only for a session that runs one', async () => {
    const onDevice = buildHarness({ transcribesOnDevice: true });
    seedVideo(onDevice.store);
    await onDevice.action.execute({ multipleSpeakers: false });

    const remote = buildHarness({ transcribesOnDevice: false });
    seedVideo(remote.store);
    await remote.action.execute({ multipleSpeakers: false });

    expect(onDevice.telemetry.propertiesOf('preprocessing_completed')).toHaveProperty(
      'transcribe_model',
    );
    expect(remote.telemetry.propertiesOf('preprocessing_completed')).not.toHaveProperty(
      'transcribe_model',
    );
  });

  it('publishes the source itself as the preview when proxying is off', async () => {
    const harness = buildHarness({ previewProxyEnabled: false });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.proxyResolveCalls()).toBe(0);
    expect(harness.store.snapshot().video.preview).toMatchObject({
      kind: 'original',
      reason: 'pipeline-disabled',
    });
    expect(harness.telemetry.propertiesOf('preprocessing_completed')).not.toHaveProperty(
      'proxy_generation_ms',
    );
  });

  it('lists a run, with its project, until that project is saved', async () => {
    const projects = new UploadingProjectRepository();
    const harness = buildHarness({ projects });
    openVideo(harness.store, 'clip.mp4');
    const run = harness.action.execute({ multipleSpeakers: false });
    await until(() => projects.isUploading('project-1'));

    expect(harness.runsStore.runs.map((listed) => listed.projectId)).toEqual(['project-1']);
    projects.finishUpload('project-1');
    await run;
    expect(harness.runsStore.runs).toEqual([]);
  });

  it('keeps listing a run that failed until its project is stored, without captions', async () => {
    const projects = new UploadingProjectRepository();
    const harness = buildHarness({
      projects,
      transcribe: async () => {
        await until(() => projects.isUploading('project-1'));
        throw new Error('transcriber exploded');
      },
    });
    openVideo(harness.store, 'clip.mp4');
    const run = harness.action.execute({ multipleSpeakers: false });
    await until(() => harness.store.snapshot().error !== null);

    expect(harness.runsStore.runs.map((listed) => listed.projectId)).toEqual(['project-1']);
    projects.finishUpload('project-1');
    await run;
    expect(harness.runsStore.runs).toEqual([]);
    expect(await projects.has('project-1')).toBe(true);
    expect(projects.wordsSavedFor('project-1')).toBeNull();
  });

  it('starts a video again after its run failed, while the failed run is still storing its project', async () => {
    const projects = new UploadingProjectRepository();
    const harness = buildHarness({
      projects,
      transcribe: async (call) => {
        if (call === 1) {
          await until(() => projects.isUploading('project-1'));
          throw new Error('transcriber exploded');
        }
        return documentSaying('again');
      },
    });
    openVideo(harness.store, 'clip.mp4');
    const failed = harness.action.execute({ multipleSpeakers: false });
    await until(() => harness.store.snapshot().error !== null);

    const again = harness.action.execute({ multipleSpeakers: false });
    await until(() => harness.transcribeCalls() === 2);
    projects.finishUpload('project-1');
    await Promise.all([failed, again]);

    expect(projects.wordsSavedFor('project-1')).toEqual(['again']);
  });

  it("tells the reader what the transcription left out, while the editor shows the run's session", async () => {
    const harness = buildHarness({ untranscribedRegions: () => [{ startSeconds: 1, endSeconds: 2 }] });
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.untranscribedRegionsStore.notice?.regions).toEqual([{ startSeconds: 1, endSeconds: 2 }]);
  });

  it('clears the notice of the session before when a run starts', async () => {
    const harness = buildHarness();
    harness.untranscribedRegionsStore.publish([{ startSeconds: 1, endSeconds: 2 }], 'base');
    seedVideo(harness.store);

    await harness.action.execute({ multipleSpeakers: false });

    expect(harness.untranscribedRegionsStore.notice).toBeNull();
  });

  it('starts a single run when asked twice for the same video', async () => {
    const harness = buildHarness();
    seedVideo(harness.store);

    await Promise.all([
      harness.action.execute({ multipleSpeakers: false }),
      harness.action.execute({ multipleSpeakers: false }),
    ]);

    expect(harness.transcribeCalls()).toBe(1);
  });

  describe('when another video is opened before a run is over', () => {
    it('keeps what the first transcription left out off the video opened since', async () => {
      let secondOpened = false;
      const harness = buildHarness({
        transcribe: async (call) => {
          if (call === 1) await until(() => secondOpened);
          return documentWithOneWord();
        },
        untranscribedRegions: (call) => (call === 1 ? [{ startSeconds: 1, endSeconds: 2 }] : []),
      });
      openVideo(harness.store, 'first.mp4');
      const first = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.transcribeCalls() === 1);

      openVideo(harness.store, 'second.mp4');
      secondOpened = true;
      await first;

      expect(harness.untranscribedRegionsStore.notice).toBeNull();
    });

    it('saves each project with the captions of its own video', async () => {
      const projects = new UploadingProjectRepository();
      const harness = buildHarness({
        projects,
        transcribe: async (call) => documentSaying(call === 1 ? 'first' : 'second'),
      });

      await openSecondVideoWhileFirstUploads(harness, projects);

      expect(projects.wordsSavedFor('project-1')).toEqual(['first']);
      expect(projects.wordsSavedFor('project-2')).toEqual(['second']);
    });

    it('keeps the first video\'s proxy under its own project', async () => {
      const projects = new UploadingProjectRepository();
      const harness = buildHarness({ projects });

      await openSecondVideoWhileFirstUploads(harness, projects);

      expect(await harness.proxyRepository.load('project-1')).toEqual(PROXY);
    });

    it('finishes the first run once its own project is saved, without waiting for the second upload', async () => {
      const projects = new UploadingProjectRepository();
      const harness = buildHarness({ projects });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.passesRun.includes('refresh'));
      openVideo(harness.store, 'second.mp4');
      const secondRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => projects.isUploading('project-2'));

      projects.finishUpload('project-1');
      await until(() => harness.telemetry.names().includes('preprocessing_completed'));

      expect(projects.isUploading('project-2')).toBe(true);
      projects.finishUpload('project-2');
      await Promise.all([firstRun, secondRun]);
    });

    it('leaves the newly opened video alone when the first transcription lands after it', async () => {
      let finishFirstTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        transcribe: (call) => (call === 1
          ? new Promise<Document>((resolve) => { finishFirstTranscription = resolve; })
          : Promise.resolve(documentSaying('second'))),
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.store.snapshot().projectId === 'project-1');

      const second = openVideo(harness.store, 'second.mp4');
      finishFirstTranscription(documentSaying('first'));
      await firstRun;

      const state = harness.store.snapshot();
      expect(state.video.file).toBe(second);
      expect(state.document).toBeNull();
      expect(state.video.preview).toBeNull();
    });

    it('saves its captions in its own project when another video is opened before they land', async () => {
      const projects = new UploadingProjectRepository();
      let finishFirstTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        projects,
        transcribe: () => new Promise<Document>((resolve) => { finishFirstTranscription = resolve; }),
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => projects.isUploading('project-1'));

      const second = openVideo(harness.store, 'second.mp4');
      finishFirstTranscription(documentSaying('first'));
      projects.finishUpload('project-1');
      await firstRun;

      expect(projects.wordsSavedFor('project-1')).toEqual(['first']);
      expect(harness.store.snapshot().video.file).toBe(second);
      expect(harness.store.snapshot().document).toBeNull();
      expect(harness.telemetry.propertiesOf('preprocessing_completed')).toMatchObject({
        project_id: 'project-1',
        editor_session_replaced: true,
      });
    });

    it('runs every pass on its own captions, and none on the newly opened video', async () => {
      let finishFirstTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        transcribe: () => new Promise<Document>((resolve) => { finishFirstTranscription = resolve; }),
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.store.snapshot().projectId === 'project-1');

      openVideo(harness.store, 'second.mp4');
      finishFirstTranscription(documentSaying('first'));
      await firstRun;

      expect(harness.passesRun).toEqual(['taggers', 'multipleSpeakers', 'textDirection', 'captionModes', 'refresh']);
      expect(harness.passesRunOn(harness.store)).toEqual([]);
    });

    it('tags its captions again in its own store when another video is opened during tagging', async () => {
      const projects = new UploadingProjectRepository();
      let finishTagging: () => void = () => undefined;
      let taggingRuns = 0;
      const harness = buildHarness({
        projects,
        transcribe: async () => documentSaying('first'),
        runTaggers: () => {
          taggingRuns++;
          return taggingRuns === 1 ? new Promise<void>((resolve) => { finishTagging = resolve; }) : Promise.resolve();
        },
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.passesRun.includes('taggers'));

      openVideo(harness.store, 'second.mp4');
      finishTagging();
      projects.finishUpload('project-1');
      await firstRun;

      expect(harness.passesRunOn(harness.store)).toEqual(['taggers']);
      expect(harness.passesRun).toEqual(['taggers', 'taggers', 'multipleSpeakers', 'textDirection', 'captionModes', 'refresh']);
      expect(projects.wordsSavedFor('project-1')).toEqual(['first']);
    });

    it('establishes its project in its own store when another video is opened before it has one', async () => {
      const projects = new UploadingProjectRepository();
      let writeProjectCopy: () => void = () => undefined;
      const harness = buildHarness({
        projects,
        transcribe: async () => documentSaying('first'),
        projectCopyWritten: () => new Promise<void>((resolve) => { writeProjectCopy = resolve; }),
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.passesRun.includes('refresh'));

      openVideo(harness.store, 'second.mp4');
      writeProjectCopy();
      await until(() => projects.isUploading('project-1'));
      projects.finishUpload('project-1');
      await firstRun;

      expect(projects.wordsSavedFor('project-1')).toEqual(['first']);
      expect(harness.store.snapshot().projectId).toBeNull();
    });

    it('keeps a failure of the first video off the newly opened one', async () => {
      let failFirstTranscription: (cause: Error) => void = () => undefined;
      const harness = buildHarness({
        transcribe: (call) => (call === 1
          ? new Promise<Document>((_resolve, reject) => { failFirstTranscription = reject; })
          : Promise.resolve(documentSaying('second'))),
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.store.snapshot().projectId === 'project-1');

      openVideo(harness.store, 'second.mp4');
      failFirstTranscription(new Error('connection lost'));
      await firstRun;

      expect(harness.store.snapshot().error).toBeNull();
    });

    it('leaves the progress of the newly opened video to its own run', async () => {
      const projects = new UploadingProjectRepository();
      let finishFirstTranscription: (document: Document) => void = () => undefined;
      let finishSecondTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        projects,
        transcribe: (call, progress) => {
          progress.start('audio-extract');
          return new Promise<Document>((resolve) => {
            if (call === 1) finishFirstTranscription = resolve;
            else finishSecondTranscription = resolve;
          });
        },
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => projects.isUploading('project-1'));
      openVideo(harness.store, 'second.mp4');
      const secondRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => projects.isUploading('project-2'));

      finishFirstTranscription(documentSaying('first'));
      projects.finishUpload('project-1');
      await firstRun;

      expect(harness.progressStore.status.phase).toBe('audio-extract');
      finishSecondTranscription(documentSaying('second'));
      projects.finishUpload('project-2');
      await secondRun;
    });

    it('keeps its progress off the screen of the newly opened video', async () => {
      let firstProgress: PreprocessingProgressStore | null = null;
      const harness = buildHarness({
        transcribe: (call, progress) => {
          progress.start('audio-extract');
          if (call === 1) firstProgress = progress;
          return new Promise<Document>(() => undefined);
        },
      });
      openVideo(harness.store, 'first.mp4');
      void harness.action.execute({ multipleSpeakers: false });
      await until(() => firstProgress !== null);
      expect(harness.progressStore.status.phase).toBe('audio-extract');

      openVideo(harness.store, 'second.mp4');
      void harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.transcribeCalls() === 2);
      const secondStatus = harness.progressStore.status;
      firstProgress!.setAudioExtractProgress(0.8);
      firstProgress!.enterInferringPhase();
      firstProgress!.cancel();

      expect(harness.progressStore.status).toEqual(secondStatus);
      expect(secondStatus).toMatchObject({ active: true, phase: 'audio-extract', rawProgress: 0 });
    });

    it('counts its own phases to the end when the reader leaves before its transcription lands', async () => {
      const clock = new ManualClock();
      vi.spyOn(performance, 'now').mockImplementation(() => clock.now());
      let finishFirstTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        transcribe: (call, progress) => {
          progress.start('audio-extract');
          clock.advance(call === 1 ? 1_000 : 30_000);
          progress.enterInferringPhase();
          if (call === 1) return new Promise<Document>((resolve) => { finishFirstTranscription = resolve; });
          clock.advance(30_000);
          return Promise.resolve(documentSaying('second'));
        },
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.progressStore.status.phase === 'inferring');
      clock.advance(2_000);

      openVideo(harness.store, 'second.mp4');
      const secondRun = harness.action.execute({ multipleSpeakers: false });
      await secondRun;
      finishFirstTranscription(documentSaying('first'));
      await firstRun;

      const firstOutcome = harness.telemetry.allPropertiesOf('preprocessing_completed')
        .find((properties) => properties.editor_session_replaced === true);
      expect(firstOutcome).toMatchObject({ audio_extract_ms: 1_000, inferring_ms: 62_000 });
    });

    it('tells the two runs apart in what they report', async () => {
      const projects = new UploadingProjectRepository();
      const harness = buildHarness({ projects });

      await openSecondVideoWhileFirstUploads(harness, projects);

      const [firstStarted, secondStarted] = harness.telemetry.allPropertiesOf('preprocessing_started');
      const completed = harness.telemetry.allPropertiesOf('preprocessing_completed');
      expect(firstStarted?.run_id).not.toBe(secondStarted?.run_id);
      expect(completed.find((properties) => properties.project_id === 'project-1')).toMatchObject({
        run_id: firstStarted?.run_id,
        editor_session_replaced: true,
      });
      expect(completed.find((properties) => properties.project_id === 'project-2')).toMatchObject({
        run_id: secondStarted?.run_id,
        editor_session_replaced: false,
      });
    });

    it('counts only its own phases in the time it reports', async () => {
      const clock = new ManualClock();
      vi.spyOn(performance, 'now').mockImplementation(() => clock.now());
      const projects = new UploadingProjectRepository();
      const harness = buildHarness({
        projects,
        transcribe: async (call, progress) => {
          progress.start('audio-extract');
          clock.advance(call === 1 ? 1_000 : 30_000);
          progress.enterInferringPhase();
          clock.advance(call === 1 ? 2_000 : 30_000);
          return documentWithOneWord();
        },
      });

      await openSecondVideoWhileFirstUploads(harness, projects);

      const [firstCompleted] = harness.telemetry.allPropertiesOf('preprocessing_completed');
      expect(firstCompleted).toMatchObject({ audio_extract_ms: 1_000, inferring_ms: 2_000 });
    });
  });

  describe('the project a run names', () => {
    it('names its project in the transcription request before the project is established', async () => {
      let writeProjectCopy: () => void = () => undefined;
      const harness = buildHarness({
        projectCopyWritten: () => new Promise<void>((resolve) => { writeProjectCopy = resolve; }),
      });
      seedVideo(harness.store);

      const run = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.transcribeCalls() === 1);
      const editorProjectWhenAsked = harness.store.snapshot().projectId;
      writeProjectCopy();
      await run;

      expect(editorProjectWhenAsked).toBeNull();
      expect(harness.transcriptionProjects()).toEqual(['project-1']);
      expect(harness.store.snapshot().projectId).toBe('project-1');
    });

    it('names its own project when another video is opened before its audio is sent', async () => {
      const projects = new UploadingProjectRepository();
      let finishFirstTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        projects,
        transcribe: (call) => (call === 1
          ? new Promise<Document>((resolve) => { finishFirstTranscription = resolve; })
          : Promise.resolve(documentSaying('second'))),
      });
      openVideo(harness.store, 'first.mp4');
      const firstRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.transcribeCalls() === 1);

      openVideo(harness.store, 'second.mp4');
      const secondRun = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.transcribeCalls() === 2);
      finishFirstTranscription(documentSaying('first'));
      projects.finishUpload('project-1');
      projects.finishUpload('project-2');
      await Promise.all([firstRun, secondRun]);

      expect(harness.transcriptionProjects()).toEqual(['project-1', 'project-2']);
      expect(projects.wordsSavedFor('project-1')).toEqual(['first']);
    });

    it('names no project for a run that saves none', async () => {
      const harness = buildHarness({ canPersist: false });
      seedVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.transcriptionProjects()).toEqual([null]);
      expect(harness.projectsCreated()).toBe(0);
    });

    it('keeps the project the session already has', async () => {
      const harness = buildHarness();
      seedVideo(harness.store);
      harness.store.patch({ projectId: 'existing-project' });

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.transcriptionProjects()).toEqual(['existing-project']);
      expect(harness.projectsCreated()).toBe(0);
      expect(harness.store.snapshot().projectId).toBe('existing-project');
    });
  });

  describe('when a saved project is opened before a run is over', () => {
    const SAVED_PROJECT = 'saved-project';

    /**
     * Starts opening a saved project the way the editor does: it shows
     * that it is loading, and names the project it loads before that
     * project's video and captions are in place.
     */
    function startOpeningSavedProject(store: EditorStore): void {
      store.patch({ status: 'loading-project' });
      store.patch({ projectId: SAVED_PROJECT });
    }

    /** Puts the saved project's video and captions in place, which ends its opening. */
    function finishOpeningSavedProject(store: EditorStore): void {
      store.patch({
        video: { file: null, url: null, fileName: 'saved.mp4' },
        document: documentSaying('saved'),
        projectId: SAVED_PROJECT,
        projectName: 'Saved',
        status: 'idle',
      });
    }

    it('saves the run\'s captions and proxy under its own project, and nothing under the opened one', async () => {
      const projects = new UploadingProjectRepository();
      projects.holdSavedEarlier(SAVED_PROJECT);
      const harness = buildHarness({ projects, transcribe: async () => documentSaying('first') });
      openVideo(harness.store, 'first.mp4');
      const run = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.passesRun.includes('refresh'));

      startOpeningSavedProject(harness.store);
      finishOpeningSavedProject(harness.store);
      projects.finishUpload('project-1');
      await run;

      expect(projects.wordsSavedFor('project-1')).toEqual(['first']);
      expect(projects.wordsSavedFor(SAVED_PROJECT)).toBeNull();
      expect(await harness.proxyRepository.load('project-1')).toEqual(PROXY);
      expect(await harness.proxyRepository.load(SAVED_PROJECT)).toBeNull();
    });

    it('leaves the project being opened alone when the run\'s transcription lands meanwhile', async () => {
      const projects = new UploadingProjectRepository();
      projects.holdSavedEarlier(SAVED_PROJECT);
      let finishTranscription: (document: Document) => void = () => undefined;
      const harness = buildHarness({
        projects,
        transcribe: () => new Promise<Document>((resolve) => { finishTranscription = resolve; }),
      });
      openVideo(harness.store, 'first.mp4');
      const run = harness.action.execute({ multipleSpeakers: false });
      await until(() => projects.isUploading('project-1'));

      startOpeningSavedProject(harness.store);
      finishTranscription(documentSaying('first'));
      await until(() => harness.proxyResolveCalls() === 1);
      projects.finishUpload('project-1');
      await run;

      const state = harness.store.snapshot();
      expect(state.status).toBe('loading-project');
      expect(state.document).toBeNull();
      expect(state.video.preview).toBeNull();
      expect(projects.wordsSavedFor(SAVED_PROJECT)).toBeNull();
    });
  });

  it('reports when the editor opened apart from when the project was saved', async () => {
    const clock = new ManualClock();
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now());
    const projects = new UploadingProjectRepository();
    const harness = buildHarness({
      projects,
      transcribe: async () => {
        clock.advance(20_000);
        return documentWithOneWord();
      },
    });
    openVideo(harness.store, 'clip.mp4');
    const run = harness.action.execute({ multipleSpeakers: false });
    await until(() => harness.passesRun.includes('refresh'));

    clock.advance(40_000);
    projects.finishUpload('project-1');
    await run;

    expect(harness.telemetry.propertiesOf('preprocessing_completed')).toMatchObject({
      editor_ready_ms: 20_000,
      elapsed_ms: 60_000,
      project_id: 'project-1',
    });
  });

  describe('with a video this browser cannot decode', () => {
    const HEVC_FROM_A_PHONE = new Map([['video/quicktime', 'hevc']]);

    function seedHevcVideo(store: EditorStore): void {
      store.patchVideo({ file: new File(['hevc'], 'clip.MOV', { type: 'video/quicktime' }), duration: 30 });
    }

    it('works from the conversion once the reader accepts it', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      const { video, error, projectId } = harness.store.snapshot();
      expect(error).toBeNull();
      expect(video.file?.type).toBe('video/mp4');
      expect(harness.transcribedFiles().map((file) => file.type)).toEqual(['video/mp4']);
      expect(projectId).toBe('project-1');
    });

    it('takes the offer back, and creates nothing, when another video is opened while it waits', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE });
      harness.offerStore.addEventListener('change', () => {
        if (harness.offerStore.offer !== null) openVideo(harness.store, 'other.mp4');
      });
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      const { video, projectId } = harness.store.snapshot();
      expect(harness.offerStore.offer).toBeNull();
      expect(video.file?.name).toBe('other.mp4');
      expect(projectId).toBeNull();
      expect(harness.transcribeCalls()).toBe(0);
      expect(harness.converter.converted).toEqual([]);
      expect(harness.telemetry.names()).toEqual(['preprocessing_started', 'video_conversion_offered']);
    });

    it('takes the offer back when a saved project is opened while it waits', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE });
      const offered = new Promise<void>((resolve) => {
        harness.offerStore.addEventListener('change', () => {
          if (harness.offerStore.offer !== null) resolve();
        });
      });
      seedHevcVideo(harness.store);

      const run = harness.action.execute({ multipleSpeakers: false });
      await offered;
      harness.store.patch({ status: 'loading-project' });
      await run;

      expect(harness.offerStore.offer).toBeNull();
      expect(harness.converter.converted).toEqual([]);
    });

    it('stops an accepted conversion, and creates nothing, when another video is opened while it converts', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE, conversionRunsUntilStopped: true });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      const run = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.converter.converting);
      openVideo(harness.store, 'other.mp4');
      await run;

      const { video, error, projectId } = harness.store.snapshot();
      expect(harness.converter.stopped).toEqual(['clip.MOV']);
      expect(video.file?.name).toBe('other.mp4');
      expect(error).toBeNull();
      expect(projectId).toBeNull();
      expect(harness.transcribeCalls()).toBe(0);
      expect(harness.telemetry.names()).not.toContain('video_conversion_failed');
      expect(harness.telemetry.propertiesOf('video_conversion_abandoned')).toMatchObject({ reached_percent: 50 });
    });

    it('stops an accepted conversion when a saved project is opened while it converts', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE, conversionRunsUntilStopped: true });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      const run = harness.action.execute({ multipleSpeakers: false });
      await until(() => harness.converter.converting);
      harness.store.patch({ status: 'loading-project' });
      await run;

      expect(harness.converter.stopped).toEqual(['clip.MOV']);
      expect(harness.transcribeCalls()).toBe(0);
    });

    it('plays the conversion as it is instead of encoding a proxy from it', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.proxyResolveCalls()).toBe(0);
      expect(harness.proxyRepository.count()).toBe(0);
      expect(harness.store.snapshot().video.preview).toMatchObject({ kind: 'original', reason: 'converted-source' });
    });

    it('reports the conversion from offer to result, and its time in the run', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.telemetry.names()).toEqual([
        'preprocessing_started',
        'video_conversion_offered',
        'video_conversion_accepted',
        'video_conversion_completed',
        'preprocessing_completed',
      ]);
      expect(harness.telemetry.propertiesOf('video_conversion_offered')).toMatchObject({
        video_codec: 'hevc',
        estimate_s: 95,
      });
      expect(harness.telemetry.propertiesOf('preprocessing_completed')).toHaveProperty('converting_ms');
    });

    it('ends with the refusal, and saves nothing, when the reader declines', async () => {
      const harness = buildHarness({ refusedCodecs: HEVC_FROM_A_PHONE });
      harness.reader.answerWith(false);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      const { status, error, projectId } = harness.store.snapshot();
      expect(status).toBe('idle');
      expect(error?.name).toBe('UnsupportedVideoCodecError');
      expect(projectId).toBeNull();
      expect(harness.transcribeCalls()).toBe(0);
      expect(harness.converter.converted).toEqual([]);
      expect(harness.telemetry.names()).toEqual([
        'preprocessing_started',
        'video_conversion_offered',
        'video_conversion_declined',
        'preprocessing_failed',
      ]);
    });

    it('ends with a conversion failure when the accepted conversion stops', async () => {
      const harness = buildHarness({
        refusedCodecs: HEVC_FROM_A_PHONE,
        conversionFailure: new Error('decoder worker crashed'),
      });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      const { status, error, projectId } = harness.store.snapshot();
      expect(status).toBe('idle');
      expect(error?.name).toBe('VideoConversionFailedError');
      expect(projectId).toBeNull();
      expect(harness.transcribeCalls()).toBe(0);
      expect(harness.telemetry.propertiesOf('video_conversion_failed')).toMatchObject({
        error_name: 'VideoConversionFailedError',
      });
    });

    it('fails the conversion when its result does not decode either', async () => {
      const harness = buildHarness({
        refusedCodecs: new Map([['video/quicktime', 'hevc'], ['video/mp4', 'avc']]),
      });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.store.snapshot().error?.name).toBe('VideoConversionFailedError');
      expect(harness.transcribeCalls()).toBe(0);
    });

    it('warns that a long video may need more memory than the tab gets, where the browser keeps decoded frames', async () => {
      const harness = buildHarness({
        refusedCodecs: HEVC_FROM_A_PHONE,
        browserKeepsDecodedFrames: true,
        decodedPixels: A_MINUTE_OF_PORTRAIT_1080P,
      });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.reader.offersSeen.map((offer) => offer.memoryHeavy)).toEqual([true]);
      expect(harness.telemetry.propertiesOf('video_conversion_offered')).toMatchObject({ memory_heavy: true });
      expect(harness.store.snapshot().error).toBeNull();
    });

    it('does not warn about memory for a short video, even where the browser keeps decoded frames', async () => {
      const harness = buildHarness({
        refusedCodecs: HEVC_FROM_A_PHONE,
        browserKeepsDecodedFrames: true,
        decodedPixels: FIVE_SECONDS_OF_PORTRAIT_1080P,
      });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.reader.offersSeen.map((offer) => offer.memoryHeavy)).toEqual([false]);
    });

    it('does not warn about memory where the browser frees each frame, however long the video', async () => {
      const harness = buildHarness({
        refusedCodecs: HEVC_FROM_A_PHONE,
        browserKeepsDecodedFrames: false,
        decodedPixels: A_MINUTE_OF_PORTRAIT_1080P,
      });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.reader.offersSeen.map((offer) => offer.memoryHeavy)).toEqual([false]);
    });

    it('offers nothing for a codec the conversion does not read', async () => {
      const harness = buildHarness({ refusedCodecs: new Map([['video/quicktime', 'prores']]) });
      harness.reader.answerWith(true);
      seedHevcVideo(harness.store);

      await harness.action.execute({ multipleSpeakers: false });

      expect(harness.store.snapshot().error?.name).toBe('UnsupportedVideoCodecError');
      expect(harness.converter.converted).toEqual([]);
    });
  });
});
