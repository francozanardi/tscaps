import type { SegmentVisibilityOverrideRegistry } from '@core/captions/domain/SegmentVisibilityOverrideRegistry';

/** What decides, for the caption track being derived, which scenes are painted. */
export interface SegmentVisibilitySettings {
  overrides(): SegmentVisibilityOverrideRegistry;
  hidesBriefScenes(): boolean;
}
