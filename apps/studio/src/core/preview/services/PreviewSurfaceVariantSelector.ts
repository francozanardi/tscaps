import type { PreviewSurfaceVariant } from '@core/preview/domain/VideoPreviewSurface';

/**
 * Boot-time preference for which preview surface variant to pick:
 * - `canvas` / `native` force the corresponding surface unconditionally.
 * - `auto` defers the choice to
 *   {@link PreviewSurfaceVariantSelector}, which applies runtime
 *   heuristics (device signals, source characteristics) to pick a
 *   concrete variant.
 */
export type PreviewSurfaceVariantPreference = 'auto' | 'canvas' | 'native';

/**
 * Resolves a {@link PreviewSurfaceVariantPreference} into a concrete
 * {@link PreviewSurfaceVariant} the boot pipeline can build against.
 *
 * `canvas` and `native` are honoured verbatim so they act as manual
 * overrides for testing and for entry points that know their needs
 * (e.g. an SRT-burn page that always wants the native surface).
 *
 * `auto` is where automatic selection will live — device class,
 * available memory, expected source duration, codec support probing,
 * etc. Today it collapses to `canvas` (the historically shipping
 * default) so no user-visible behaviour changes until real heuristics
 * are added here.
 */
export class PreviewSurfaceVariantSelector {

  constructor(private readonly preference: PreviewSurfaceVariantPreference) {}

  select(): PreviewSurfaceVariant {
    if (this.preference === 'canvas' || this.preference === 'native') {
      return this.preference;
    }
    return this.selectAutomatically();
  }

  private selectAutomatically(): PreviewSurfaceVariant {
    return 'canvas';
  }
}
