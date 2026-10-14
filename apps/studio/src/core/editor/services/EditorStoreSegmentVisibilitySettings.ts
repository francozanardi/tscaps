import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SegmentVisibilitySettings } from '@core/captions/domain/SegmentVisibilitySettings';
import type { SegmentVisibilityOverrideRegistry } from '@core/captions/domain/SegmentVisibilityOverrideRegistry';

/** Reads the active caption track's visibility settings at the moment they are asked for. */
export class EditorStoreSegmentVisibilitySettings implements SegmentVisibilitySettings {
  constructor(private readonly store: EditorStore) {}

  overrides(): SegmentVisibilityOverrideRegistry {
    return this.store.snapshot().segmentVisibilityOverrides;
  }

  hidesBriefScenes(): boolean {
    return this.store.snapshot().hideBriefScenes;
  }
}
