import type { EditorStore } from '@core/editor/store/EditorStore';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import { DEFAULT_PERSON_SEGMENTATION_OPTIONS } from '@core/person-segmentation/domain/PersonSegmentationOptions';
import type { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import type { ScanVideoSource, ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import type { PersonMaskCapturer } from '@core/person-segmentation/infrastructure/PersonMaskCapturer';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import type { SegmentMaskBackfillStore } from '@core/person-segmentation/store/SegmentMaskBackfillStore';

export interface EnsureSegmentMasksCachedInput {
  readonly segmentId: string;
  readonly range: PersonSegmentationWindow;
}

/**
 * Guarantees the cached detector result carries actor masks across the
 * given segment range — the on-demand path for a force-on segment that
 * sits outside the detector's valid windows, where the initial scan
 * captured nothing. Timestamps already covered by the cache are
 * skipped; missing ones are segmented against the currently loaded
 * video, merged into the cached result, persisted, and re-published to
 * the in-memory slot. Resolves immediately when the range is already
 * covered. Sessions without a persisted project id are supported:
 * the merged result lives only in memory. Throws when no video is
 * loaded or when the capture fails; the busy flag is cleared either
 * way.
 *
 * Executions are serialized: each run reads the cached result after
 * every earlier run has merged and stored, so two concurrent backfills
 * cannot overwrite each other's masks.
 */
export class EnsureSegmentMasksCachedAction {
  private lastRun: Promise<void> = Promise.resolve();

  constructor(
    private readonly editorStore: EditorStore,
    private readonly sourceResolver: ScanVideoSourceResolver,
    private readonly videoLoader: HiddenVideoLoader,
    private readonly workerClient: PersonSegmenterWorkerClient,
    private readonly maskCapturer: PersonMaskCapturer,
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly loadedStore: LoadedPersonSegmentationCacheStore,
    private readonly backfillStore: SegmentMaskBackfillStore,
  ) {}

  execute(input: EnsureSegmentMasksCachedInput): Promise<void> {
    const run = this.lastRun.then(() => this.ensureCached(input));
    this.lastRun = run.catch(() => {});
    return run;
  }

  private async ensureCached(input: EnsureSegmentMasksCachedInput): Promise<void> {
    const projectId = this.editorStore.snapshot().projectId;
    const current = await this.loadCurrentResult(projectId);
    const missingTimestamps = this.findMissingTimestamps(current.maskCache, input.range);
    if (missingTimestamps.length === 0) return;
    this.backfillStore.begin(input.segmentId);
    try {
      const captured = await this.captureMasks(missingTimestamps);
      const merged: PersonSegmentationResult = {
        windows: current.windows,
        maskCache: current.maskCache.mergedWith(captured),
      };
      if (projectId !== null) await this.cacheRepository.store(projectId, merged);
      this.loadedStore.publish(projectId, merged);
    } finally {
      this.backfillStore.finish(input.segmentId);
    }
  }

  private async loadCurrentResult(projectId: string | null): Promise<PersonSegmentationResult> {
    const loaded = this.loadedStore.current;
    if (loaded !== null && loaded.projectId === projectId) return loaded.result;
    if (projectId === null) return { windows: [], maskCache: new MaskCache() };
    const stored = await this.cacheRepository.load(projectId);
    return stored ?? { windows: [], maskCache: new MaskCache() };
  }

  private findMissingTimestamps(cache: MaskCache, range: PersonSegmentationWindow): number[] {
    const step = 1 / DEFAULT_PERSON_SEGMENTATION_OPTIONS.cacheFps;
    const missing: number[] = [];
    for (let timestamp = range.start; timestamp <= range.end; timestamp += step) {
      if (cache.nearest(timestamp, step / 2) === null) missing.push(timestamp);
    }
    return missing;
  }

  private async captureMasks(timestamps: ReadonlyArray<number>): Promise<MaskCache> {
    // The worker loads WASM + models lazily; on a session where the
    // full scan never ran (cache hydrated from storage), this is the
    // first thing that touches the segmenter.
    await this.workerClient.ensureReady(DEFAULT_PERSON_SEGMENTATION_OPTIONS.maskMaxSide);
    const source = this.requireScanSource();
    try {
      const video = await this.videoLoader.load(source.url);
      try {
        return await this.maskCapturer.captureAtTimestamps(video, timestamps, new AbortController().signal, () => {});
      } finally {
        this.videoLoader.dispose(video);
      }
    } finally {
      source.dispose();
    }
  }

  private requireScanSource(): ScanVideoSource {
    const source = this.sourceResolver.resolve(this.editorStore.snapshot().video);
    if (source === null) throw new Error('No video is loaded');
    return source;
  }
}
