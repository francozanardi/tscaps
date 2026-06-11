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
}
