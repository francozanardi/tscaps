/**
 * Per-feature flags reflecting what a template supports. Every flag
 * defaults to `true` at the loader; a `false` here signals an opt-out
 * declared by the template author (e.g. a layout that would break if
 * a per-word rotate were applied).
 */
export interface RotationSupport {
  readonly segment: boolean;
  readonly word: boolean;
}

export interface FeaturesConfig {
  readonly rotation: RotationSupport;
  /**
   * Whether the per-segment "Hide behind person" override is exposed
   * on this template. Defaults to `true`; a template only sets this to
   * `false` when the manual toggle is known to break its layout.
   */
  readonly behindActorOverride: boolean;
}
