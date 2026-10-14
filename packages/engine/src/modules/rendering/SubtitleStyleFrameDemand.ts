import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { ScopedRenderOverride } from '@modules/rendering/types/ScopedRenderOverride';

/**
 * What a style needs from the frame it is painted over, read off the
 * style alone. Every place that routes or prepares a style on that
 * question asks here.
 */
export class SubtitleStyleFrameDemand {

  /** Whether any picture of the style is painted from the video frame. */
  readsVideoFrame(style: SubtitleStyle): boolean {
    return style.rendering.videoFrame.required;
  }

  /** Whether some segment or element of the style paints outside the base layer, which may take a copy of a subtree. */
  isolatesAnyElement(style: SubtitleStyle): boolean {
    return this.overridesOf(style).some((override) => override.stacking !== undefined || override.blendMode !== undefined);
  }

  private overridesOf(style: SubtitleStyle): ScopedRenderOverride[] {
    return [...(style.segmentOverrides?.values() ?? []), ...(style.subtreeOverrides?.values() ?? [])];
  }
}
