import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { RecoverProjectVideoAction } from '@core/projects/actions/RecoverProjectVideoAction';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { AppError } from '@core/errors/domain/AppError';

const METADATA: VideoSourceMetadata = {
  mimeType: 'video/mp4',
  sourceReadable: true,
  containerFormat: 'mp4',
  durationSeconds: 10,
  videoCodec: 'avc1',
  videoWidthPx: 1080,
  videoHeightPx: 1920,
  hasAudioTrack: true,
  audioCodec: 'aac',
  audioSampleRate: 48_000,
  audioChannels: 2,
};

function buildHarness(overrides?: {
  cacheVideoBlob?: (projectId: string, blob: Blob) => Promise<void>;
  reportStoreFailure?: (error: AppError) => void;
}) {
  const store = new EditorStore();
  let cachedBlob: Blob | null = null;
  let deletedSegmentationProjectId: string | null = null;
  const reportedErrors: AppError[] = [];

  const repository = {
    cacheVideoBlob: overrides?.cacheVideoBlob ?? (async (_id: string, blob: Blob) => { cachedBlob = blob; }),
  } as unknown as ProjectRepository;

  const previewProxyResolver = {
    fromRepository: async () => null,
    fromSource: async (source: Blob) => ({
      preview: { kind: 'original' as const, file: source, reason: 'none-stored' as const },
      freshProxy: null,
    }),
  } as unknown as PreviewProxyResolver;

  const proxyRepository = {
    store: async () => {},
  } as unknown as PreviewProxyRepository;

  const personSegmentationCache = {
    delete: async (id: string) => { deletedSegmentationProjectId = id; },
  } as unknown as PersonSegmentationCacheRepository;

  const compatibilityChecker = {
    check: async () => {},
  } as unknown as VideoCompatibilityChecker;

  const metadataProbe: VideoMetadataProbe = {
    probe: async () => METADATA,
  };

  const storeFailureReporter = {
    report: (error: AppError) => {
      reportedErrors.push(error);
      overrides?.reportStoreFailure?.(error);
    },
  } as unknown as NonBlockingFailureReporter;

  const action = new RecoverProjectVideoAction(
    store,
    repository,
    previewProxyResolver,
    proxyRepository,
    personSegmentationCache,
    compatibilityChecker,
    metadataProbe,
    storeFailureReporter,
  );

  return {
    store,
    action,
    getCachedBlob: () => cachedBlob,
    getDeletedSegmentationProjectId: () => deletedSegmentationProjectId,
    reportedErrors,
  };
}

const file = () => new File(['video-content'], 'recovered.mp4', { type: 'video/mp4' });

describe('RecoverProjectVideoAction', () => {
  it('throws if no project is loaded in store', async () => {
    const harness = buildHarness();

    await expect(harness.action.execute(file())).rejects.toThrow('No project loaded');
  });

  it('attaches the recovered video to the store and caches the blob', async () => {
    const harness = buildHarness();
    harness.store.patch({ projectId: 'project-123' });
    const videoFile = file();

    await harness.action.execute(videoFile);

    const snapshot = harness.store.snapshot();
    expect(snapshot.video.file).toBe(videoFile);
    expect(snapshot.video.fileName).toBe('recovered.mp4');
    expect(snapshot.video.layout).toEqual({ width: 1080, height: 1920 });
    expect(snapshot.status).toBe('idle');
    expect(harness.getCachedBlob()).toBe(videoFile);
    expect(harness.getDeletedSegmentationProjectId()).toBe('project-123');
  });

  it('reports failure when caching the video fails but still updates the store', async () => {
    const harness = buildHarness({
      cacheVideoBlob: () => Promise.reject(new Error('QuotaExceeded')),
    });
    harness.store.patch({ projectId: 'project-123' });
    const videoFile = file();

    await harness.action.execute(videoFile);

    expect(harness.store.snapshot().video.file).toBe(videoFile);
    expect(harness.reportedErrors.length).toBe(1);
    expect(harness.reportedErrors[0]?.name).toBe('ProjectVideoStoreFailedError');
  });
});
