import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { FontStackFaces } from '@core/fonts/domain/FontStackCatalog';

export const CONTROL_FIELD_TYPES = ['color', 'integer', 'float', 'toggle', 'select', 'text', 'image', 'font'] as const;
export type ControlFieldType = (typeof CONTROL_FIELD_TYPES)[number];

/**
 * What a control holds. A `font` control holds one face per writing
 * system, because the alphabets its text lands in are the reader's, not
 * the template author's.
 */
export type ControlValue = string | number | boolean | FontStackFaces;

/**
 * Which panel a control belongs to. `style` is how the captions look
 * standing still; `motion` is how they move, and shows beside the
 * animation it moves rather than in the Style tab.
 */
export const CONTROL_GROUPS = ['style', 'motion'] as const;
export type ControlGroup = (typeof CONTROL_GROUPS)[number];

// Sections inside the Style tab. "appearance" holds CSS-driven visual
// extras (padding, radius, shadows, plus toggles like uppercase/italic
// that aren't typography fundamentals). "assets" holds image-typed
// controls that swap a template's bundled binary (e.g. a brush mask).
// Distinct from the `EffectsConfig`, which is for non-CSS,
// runtime/document-level transformations.
export const STYLE_CONTROL_SUBGROUPS = ['colors', 'appearance', 'assets'] as const;
export type StyleControlSubgroup = (typeof STYLE_CONTROL_SUBGROUPS)[number];

/**
 * Which kind of element a motion control moves — the same three a sheet
 * answers for, so the control lands under the animation it belongs to.
 *
 * The library's animations carry their dials in `controls.json`; a
 * template writing its own keyframes has nowhere else to put them, and
 * naming the kind is what the subgroup is for.
 */
export const MOTION_CONTROL_SUBGROUPS = ['segments', 'words', 'emojis'] as const;
export type MotionControlSubgroup = (typeof MOTION_CONTROL_SUBGROUPS)[number];

export type ControlSubgroup = StyleControlSubgroup | MotionControlSubgroup;

/** The subgroups each group accepts. A pair from two rows is a template's mistake, not a section of its own. */
export const CONTROL_SUBGROUPS_BY_GROUP: Readonly<Record<ControlGroup, ReadonlyArray<ControlSubgroup>>> = {
  style: STYLE_CONTROL_SUBGROUPS,
  motion: MOTION_CONTROL_SUBGROUPS,
};

/**
 * The subgroup a template's motion controls carry to reach one scope's
 * panel, or `null` for a scope that is not a sheet's to answer.
 *
 * The one place the two vocabularies meet, so a subgroup cannot come to
 * mean a scope in one reader and another somewhere else.
 */
export const MOTION_SUBGROUP_BY_SCOPE: Readonly<Record<ElementAnimationScope, MotionControlSubgroup | null>> = {
  [ElementAnimationScope.SELF]: null,
  [ElementAnimationScope.SEGMENTS]: 'segments',
  [ElementAnimationScope.WORDS]: 'words',
  [ElementAnimationScope.EMOJIS]: 'emojis',
};

// CSS units appended to numeric values when injecting as a CSS var.
// `cqh` / `cqw` resolve against the subtitle overlay's container (the
// scaler element in preview, the foreignObject root in export) — see
// `container-type: size` in SubtitleOverlay.css and the bitmap renderer.
// Use `cqh` for font-size and vertical chrome (the broadcast convention
// of "% of video height"), `cqw` for horizontal chrome whose width
// naturally tracks the video's width (e.g. fixed-width windows).
// Use `em` for dimensions that should track the text size; reserve
// `px` for true hairlines. `s` is for durations a template's own
// keyframes read — the only unit here that is not a length.
export const CONTROL_UNITS = ['px', '%', 'em', 'cqh', 'cqw', 's'] as const;
export type ControlUnit = (typeof CONTROL_UNITS)[number];

// Used by select / autocomplete. `cssValue` lets the stored value (a friendly
// slug) be different from what is emitted to the CSS var (e.g. shadow presets:
// stored 'hard-3d', emitted as the full text-shadow string).
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly cssValue?: string;
}

// A single user-editable control. Used by style controls (free-form ids that
// become CSS vars) and by splitter/alignment descriptors (ids match config keys).
export interface ControlField {
  readonly id: string;
  readonly label: string;
  readonly type: ControlFieldType;
  readonly default: ControlValue;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: ControlUnit;
  // Which panel the control shows in, and which section of it. The two
  // travel together — `CONTROL_SUBGROUPS_BY_GROUP` says which pairs
  // exist, and the template contract check refuses the rest. Only
  // meaningful for style controls.
  readonly group?: ControlGroup;
  readonly subgroup?: ControlSubgroup;
  // Required for type='select'. Stored value is one of options[].value.
  readonly options?: readonly SelectOption[];
  // For type='toggle': CSS values emitted for true / false. Stored value is
  // a boolean; buildCssVars translates it to the literal string here.
  readonly valueOn?: string;
  readonly valueOff?: string;
  // Optional inline help text rendered below the control. Use it when a
  // label alone can't convey what the control does (e.g. a toggle whose
  // OFF state has non-obvious consequences). Shown muted and small.
  readonly legend?: string;
  // Marks a control whose underlying feature is unavailable on some
  // surfaces. Consumers on an affected surface render it as a gated
  // affordance (dimmed, non-interactive, with an upgrade pill routing
  // to the landing) instead of a live control.
  readonly cloudOnly?: boolean;
}
