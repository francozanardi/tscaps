import type { CaptionlessSpan } from '@core/captions/domain/CaptionlessSpan';
import type { SegmentVisibilityOverrideRegistry } from '@core/captions/domain/SegmentVisibilityOverrideRegistry';

/** What decides, for the caption track being derived, which scenes are painted. */
export interface SegmentVisibilitySettings {
  overrides(): SegmentVisibilityOverrideRegistry;
  hidesBriefScenes(): boolean;
  /** Where the captions are kept off, whatever the scenes there say: under a graphic that hides them. */
  captionlessSpans(): ReadonlyArray<CaptionlessSpan>;
}
