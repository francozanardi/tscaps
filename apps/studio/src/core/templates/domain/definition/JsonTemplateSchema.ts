import type { AlignmentConfig } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { SerializedTypographyConfig } from '@core/sheets/services/TypographyConfigSerializer';

/**
 * Typography as a template author writes it. Every knob is optional and
 * falls back to the app's default.
 *
 * The font is named, not spelled out: an author picks one of the
 * catalog's stacks by id and gets a face for every writing system their
 * readers may caption in, without having to know any of them.
 */
export interface JsonTypographyConfig extends Partial<Omit<SerializedTypographyConfig, 'fontStack'>> {
  readonly fontStack?: string;
}
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { VideoFrameRequirement } from '@core/templates/domain/definition/RenderingConfig';
import type { StyleVariant } from '@core/templates/domain/definition/StyleVariant';

// Templates declare the effect configs they want as defaults. Each entry's
// sub-fields are optional; the loader fills missing fields from the
// descriptor's defaultConfig. Effects not listed here fall back to the
// registry's default (typically `enabled: false`).
export type EffectConfigOverride = Partial<EffectConfig> & { type: EffectConfig['type'] };

// Each entry in `segmentSplitters` declares one stage of the splitting
// pipeline. The `type` discriminator is required; every other field is
// optional and falls back to the descriptor's default.
export type SegmentSplitterEntry = Partial<SegmentSplitterConfig> & { type: SegmentSplitterConfig['type'] };

/**
 * A `styleControls` entry as it appears in `template.json`. Two forms:
 *
 * - **Shorthand** for a catalogued id: `{ id, default, cloudOnly?,
 *   label?, legend? }`. Type, unit, group and bounds come from
 *   `StyleControlCatalog` and cannot be redeclared; the two strings
 *   come from there too unless the template names the concept's role
 *   in its own layout.
 * - **Full** for a template-local id the catalog does not describe:
 *   the complete `ControlField` shape.
 *
 * `StyleControlResolver` picks the branch by consulting the catalog.
 */
export type JsonStyleControlEntry = ControlField | (Partial<ControlField> & { id: string; default: ControlValue });

/**
 * JSON-side rendering switches. The `padding` field is a CSS-padding
 * shorthand of `em` lengths (e.g. `"0.5em"`, `"1em 2em"`); the loader
 * parses it into the engine's per-side `EmEdges`.
 */
export interface JsonRenderingConfig {
  splitWordsIntoLetters?: boolean;
  videoFrame?: Partial<VideoFrameRequirement>;
  padding?: string;
}

/**
 * JSON-side opt-in for the text-behind-actor effect. `tagCondition`
 * is a boolean tag expression (e.g. `"peak or hook"`); absent
 * means every segment qualifies for automatic activation.
 */
export interface JsonBehindActorTemplateConfig {
  required?: boolean;
  tagCondition?: string;
}

/**
 * Opt-outs from features the engine treats as supported by default.
 * Every flag's default is `true` — a template only declares an entry
 * here when it does NOT support that feature (e.g. a template whose
 * layout would break if a per-word rotate were applied).
 */
export interface JsonFeaturesConfig {
  rotation?: { segment?: boolean; word?: boolean };
  /**
   * Which kinds of element the template's look survives being
   * animated. Keyed by the kind an animation lands on, so one entry
   * covers both the sheet's panel for that kind and one element
   * answering for itself. Declare `false` where an animation would
   * break the look — a caption that blends with the video cannot carry
   * one, since `transform` and `opacity` both put a stacking context
   * between the blend and the frame.
   */
  animation?: { segment?: boolean; line?: boolean; word?: boolean; decoration?: boolean };
  behindActorOverride?: boolean;
}

// Full JSON schema for a template's template.json file. Splitter, alignment,
// rendering, and typography configs are partial; the loader fills missing
// fields with the system defaults. `segmentSplitters` is an ordered list —
// the deriver runs the entries left-to-right.
export interface JsonTemplateSchema {
  name: string;
  /**
   * The family the gallery lists this template under, as a
   * `TemplateCategory` slug. Absent means `lab` — a template that has
   * not said where it belongs has not left the workbench.
   */
  category?: string;
  /**
   * Browsers this template must not be offered in, as `BrowserName`
   * slugs (`"chrome"`, `"edge"`, `"firefox"`, `"safari"`, `"opera"`).
   * Use to opt a template out of browsers where its CSS is known to
   * render incorrectly (e.g. `["firefox"]`).
   *
   * `"safari"` means WebKit, so it covers iOS Chrome and iOS Firefox
   * too — on iOS every browser paints with WebKit. Unknown slugs are
   * refused by the template contract.
   */
  unsupportedBrowsers?: string[];
  styleControls?: JsonStyleControlEntry[];
  typography?: JsonTypographyConfig;
  rotation?: Partial<RotationConfig>;
  segmentSplitters?: SegmentSplitterEntry[];
  lineSplitter?: Partial<LineSplitterConfig> & { type: LineSplitterConfig['type'] };
  alignment?: Partial<AlignmentConfig>;
  rendering?: JsonRenderingConfig;
  features?: JsonFeaturesConfig;
  behindActor?: JsonBehindActorTemplateConfig;
  effects?: EffectConfigOverride[];
  /**
   * Named style presets the template ships. Each variant overrides a
   * subset of `styleControls` values with the keys matching
   * `styleControls[].id`; unknown ids are silently ignored. A template
   * with two or more variants exposes a picker in the style tab and
   * powers the multi-speaker flow (one variant per speaker sheet,
   * cyclic by index). Omit or ship a single entry to behave as a
   * fixed-look template.
   */
  variants?: StyleVariant[];
}
