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
  capState(): TranscriptionAudioLengthCap {
    return { state: 'no-cap' };
  }

  enforce(): void {}

  subscribe(): () => void {
    return () => undefined;
  }
}

class CappedAudioLength implements TranscriptionAudioLengthPolicy {
  constructor(private readonly seconds: number) {}

  capState(): TranscriptionAudioLengthCap {
    return { state: 'has-cap', seconds: this.seconds };
  }

  enforce(videoDurationSeconds: number): void {
    if (videoDurationSeconds > this.seconds) {
      throw new Error(`over cap: ${videoDurationSeconds} > ${this.seconds}`);
    }
  }

  subscribe(): () => void {
    return () => undefined;
  }
}

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
  readonly compatibilityCheck?: () => Promise<void>;
  readonly exportSupported?: boolean;
  readonly metadata?: VideoSourceMetadata;
} = {}) {
  const store = new EditorStore();
  const progressStore = new PreprocessingProgressStore();
  const telemetry = new RecordingTelemetry();
  const proxyRepository = new InMemoryPreviewProxyRepository();
  const passesRun: string[] = [];
  const saveFailures = new RecordingFailureReporter();
  const videoStoreFailures = new RecordingFailureReporter();
  let transcribeCalls = 0;
  let proxyResolveCalls = 0;

  // The pipeline's collaborators are concrete action classes with no
  // port to implement, so a stub stands in structurally. Each is
  // named after what it replaces rather than cast to `never`.
  const substitute = <T>(stub: object): T => stub as T;

  const recordingPass = (name: string) => ({
    execute: () => {
      passesRun.push(name);
    },
  });

  const action = new PreprocessVideoAction(
    store,
    substitute<TranscribeAction>({
      execute: async () => {
        transcribeCalls++;
        return (overrides.transcribe ?? (async () => documentWithOneWord()))();
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
    { check: overrides.compatibilityCheck ?? (async () => undefined) },
    { isSupported: async () => overrides.exportSupported ?? true },
    overrides.audioLengthPolicy ?? new UncappedAudioLength(),
    progressStore,
    new PreprocessingTelemetryReporter(
      store,
      telemetry,
      substitute<AppErrorTelemetryDescriber>({ describe: () => ({ error_name: 'stubbed' }) }),
      'local',
      overrides.transcribesOnDevice ?? true,
    ),
    { probe: async () => overrides.metadata ?? metadataWith({}) },
    new AppErrorClassifier(),
    substitute<StoragePersistence>({ ensure: async () => true }),
    new LanguageCanonicalCodeResolver(),
  );

  return {
    action,
    store,
    telemetry,
    proxyRepository,
    passesRun,
    saveFailures,
    videoStoreFailures,
    transcribeCalls: () => transcribeCalls,
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
});
