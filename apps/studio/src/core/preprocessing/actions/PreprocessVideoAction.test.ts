import { Document, Section, Segment, Line, Word, TimeFragment } from '@tscaps/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
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
import type { ReadSubtitleFileAction } from '@core/transcription/actions/ReadSubtitleFileAction';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { ApplyTextDirectionAction } from '@core/preprocessing/actions/ApplyTextDirectionAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
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

  constructor(
    private readonly failure: Error | null,
    private readonly decodedPixels: number,
  ) {}

  async estimate(): Promise<VideoConversionEstimate | null> {
    return { seconds: 95, decodedPixels: this.decodedPixels };
  }

  async convert(source: File, onProgress: (fraction: number) => void): Promise<File> {
    onProgress(0.5);
    if (this.failure) throw new VideoConversionFailedError({ cause: this.failure });
    this.converted.push(source.name);
    onProgress(1);
    return new File(['converted'], 'clip.mp4', { type: 'video/mp4' });
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
  return new Document({
    sections: [
      new Section({
        segments: [
          new Segment({
            lines: [new Line({ words: [new Word({ text: 'hola', time: new TimeFragment(0, 1) })] })],
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
  readonly transcribe?: () => Promise<Document>;
  readonly resolveProxy?: () => Promise<PreviewProxyResolution>;
  readonly saveProject?: () => Promise<void>;
  readonly videoStoreFailure?: unknown;
  readonly videoIsUploaded?: boolean;
  readonly canPersist?: boolean;
  readonly previewProxyEnabled?: boolean;
  readonly transcribesOnDevice?: boolean;
  readonly refusedCodecs?: ReadonlyMap<string, string>;
  readonly browserKeepsDecodedFrames?: boolean;
  readonly decodedPixels?: number;
  readonly conversionFailure?: Error;
  readonly exportSupported?: boolean;
  readonly metadata?: VideoSourceMetadata;
  readonly visibility?: Omit<VisibilitySpan, 'end'>;
} = {}) {
  const store = new EditorStore();
  const progressStore = new PreprocessingProgressStore();
  const telemetry = new RecordingTelemetry();
  const proxyRepository = new InMemoryPreviewProxyRepository();
  const passesRun: string[] = [];
  const saveFailures = new RecordingFailureReporter();
  const videoStoreFailures = new RecordingFailureReporter();
  let transcribeCalls = 0;
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

  const recordingPass = (name: string) => ({
    execute: () => {
      passesRun.push(name);
    },
  });

  const action = new PreprocessVideoAction(
    store,
    substitute<TranscribeAction>({
      execute: async (file: File) => {
        transcribeCalls++;
        transcribedFiles.push(file);
        return (overrides.transcribe ?? (async () => documentWithOneWord()))();
      },
    }),
    substitute<ReadSubtitleFileAction>({
      execute: async (file: SubtitleFile) => {
        subtitleFilesRead.push(file.name);
        return documentWithOneWord();
      },
    }),
    substitute<RunTaggersAction>({
      execute: async () => {
        passesRun.push('taggers');
      },
    }),
    substitute<ApplyMultipleSpeakersAction>(recordingPass('multipleSpeakers')),
    substitute<ApplyTextDirectionAction>(recordingPass('textDirection')),
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
      progressStore,
      'sequential-after-transcribe',
      overrides.previewProxyEnabled ?? true,
    ),
    new PreprocessPersistence(
      store,
      substitute<CreateProjectAction>({
        execute: async () => {
          store.patch({ projectId: 'project-1' });
          return { videoStoreFailure: overrides.videoStoreFailure ?? null };
        },
      }),
      substitute<SaveProjectAction>({ execute: overrides.saveProject ?? (async () => undefined) }),
      substitute<OriginalVideoKeeper>({ keep: async () => overrides.videoStoreFailure ?? null }),
      () => overrides.canPersist ?? true,
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
      progressStore,
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
  );

  return {
    action,
    store,
    telemetry,
    proxyRepository,
    passesRun,
    saveFailures,
    videoStoreFailures,
    reader,
    converter,
    transcribeCalls: () => transcribeCalls,
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
  });

  function seedVideo(store: EditorStore): void {
    store.patchVideo({ file: new File(['video'], 'clip.mp4', { type: 'video/mp4' }), duration: 30 });
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
