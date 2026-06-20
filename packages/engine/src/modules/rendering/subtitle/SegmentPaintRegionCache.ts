import type { VideoFrameRegion } from '@modules/rendering/types/VideoFrameSource';

/**
 * Cache of segment paint regions keyed by `(kind, segmentId)`. Looks
 * up an entry or computes and stores one in a single call. `clear`
 * drops every entry.
 */
export class SegmentPaintRegionCache {
  private readonly regionByKey = new Map<string, VideoFrameRegion>();

  getOrCompute(kind: string, segmentId: string, compute: () => VideoFrameRegion): VideoFrameRegion {
    const key = this.composeKey(kind, segmentId);
    let region = this.regionByKey.get(key);
    if (!region) {
      region = compute();
      this.regionByKey.set(key, region);
    }
    return region;
  }

  clear(): void {
    this.regionByKey.clear();
  }

  private composeKey(kind: string, segmentId: string): string {
    return `${kind}:${segmentId}`;
  }
}
