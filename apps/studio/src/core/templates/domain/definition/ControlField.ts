export type ControlFieldType = 'color' | 'integer' | 'float' | 'toggle' | 'select' | 'text' | 'image' | 'font';
export type ControlValue = string | number | boolean;

// Visual grouping labels used by the style controls panel. "appearance"
// holds CSS-driven visual extras (padding, radius, shadows, plus toggles
// like uppercase/italic that aren't typography fundamentals). "assets"
// holds image-typed controls that swap a template's bundled binary
// (e.g. a brush mask). Distinct from the `EffectsConfig`, which is for
// non-CSS, runtime/document-level transformations.
export type ControlGroup = 'colors' | 'appearance' | 'assets';

// CSS units appended to numeric values when injecting as a CSS var.
// `cqh` / `cqw` resolve against the subtitle overlay's container (the
// scaler element in preview, the foreignObject root in export) — see
// `container-type: size` in SubtitleOverlay.css and the bitmap renderer.
// Use `cqh` for font-size and vertical chrome (the broadcast convention
// of "% of video height"), `cqw` for horizontal chrome whose width
// naturally tracks the video's width (e.g. fixed-width windows).
// Use `em` for dimensions that should track the text size; reserve
// `px` for true hairlines.
export type ControlUnit = 'px' | '%' | 'em' | 'cqh' | 'cqw';

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
  // Shown inside the collapsible Advanced section. Default: false (basic).
  readonly advanced?: boolean;
  // Visual grouping label. Only meaningful for style controls.
  readonly group?: ControlGroup;
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
