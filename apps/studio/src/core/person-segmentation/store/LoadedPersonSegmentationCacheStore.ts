import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';

export interface LoadedPersonSegmentationEntry {
  /**
   * `null` when the session has no persisted project id and the
   * result lives only in memory. Non-null when tied to a persisted
   * project.
   */
  readonly projectId: string | null;
  readonly result: PersonSegmentationResult;
}

/**
 * Observable slot for the detector result of the currently loaded
 * project. Populated by the hydration automation on project change
 * and by the run action on successful completion; consumed by the
 * preview overlay to look up masks per frame without an IndexedDB
 * round-trip.
 *
 * Subscribers listen for the `'change'` event and read `current`.
 */
export class LoadedPersonSegmentationCacheStore extends EventTarget {
  private entry: LoadedPersonSegmentationEntry | null = null;

  get current(): LoadedPersonSegmentationEntry | null {
    return this.entry;
  }

  publish(projectId: string | null, result: PersonSegmentationResult): void {
    this.entry = { projectId, result };
    this.dispatchEvent(new Event('change'));
  }

  clear(): void {
    if (this.entry === null) return;
    this.entry = null;
    this.dispatchEvent(new Event('change'));
  }
}
