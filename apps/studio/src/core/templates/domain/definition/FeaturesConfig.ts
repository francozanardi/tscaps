import type { ElementKind } from '@core/elements/domain/ElementKind';

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

/**
 * Which kinds of element this template's look survives being animated.
 *
 * Keyed by the kind an animation lands on rather than by the panel
 * offering it, because both a sheet answering for every caption and one
 * caption answering for itself write onto the same element and break
 * the same way.
 *
 * The case it exists for is `mix-blend-mode`. A caption that blends with
 * the video needs no stacking context between the blending element and
 * the frame, and every entrance in the library animates `transform` or
 * `opacity` — either of which puts one there. Measured in both engines:
 * even `translateY(0)` isolates, and the frozen-frame model keeps the
 * fill applied, so the blend does not come back when the entrance ends.
 *
 * Exhaustive over `ElementKind`: a kind added later cannot compile
 * without an answer, so nothing is quietly assumed to be animatable.
 */
export type AnimationSupport = Readonly<Record<ElementKind, boolean>>;

/**
 * Which of a caption's anchors the reader may move off the template's
 * own. The anchor is the point of the caption box its position pins —
 * its top, centre or bottom edge — and the editor otherwise picks it
 * from where the caption is dropped.
 *
 * A layout built from one edge cannot follow another. One that sizes an
 * empty stretch from where its bottom edge landed, to put a word at a
 * fixed height above it, grows the wrong way the moment its centre is
 * pinned instead. Held, the anchor stays the template's and the caption
 * still moves anywhere along it.
 */
export interface AnchorSupport {
  readonly vertical: boolean;
}

/** The `briefSceneMs` a template gets when it does not declare one. */
export const BRIEF_SCENE_MS_DEFAULT = 100;

export interface FeaturesConfig {
  readonly rotation: RotationSupport;
  readonly animation: AnimationSupport;
  readonly anchor: AnchorSupport;
  /**
   * Whether the per-segment "Hide behind person" override is exposed
   * on this template. Defaults to `true`; a template only sets this to
   * `false` when the manual toggle is known to break its layout.
   */
  readonly behindActorOverride: boolean;
  /**
   * A scene on screen for less than this many milliseconds is hidden
   * while the caption track hides brief scenes; `0` never hides one.
   * Lowered for a template whose scenes are single words, where a fast
   * word lasts as briefly as the voice cutting in that the rule is for.
   */
  readonly briefSceneMs: number;
}
