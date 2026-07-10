import type { AlignmentConfig } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { BehindActorRequirement } from '@tscaps/engine';
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
 * JSON-side rendering switches. The `padding` field is a CSS-padding
 * shorthand of `em` lengths (e.g. `"0.5em"`, `"1em 2em"`); the loader
 * parses it into the engine's per-side `EmEdges`.
 */
export interface JsonRenderingConfig {
  splitWordsIntoLetters?: boolean;
  videoFrame?: Partial<VideoFrameRequirement>;
  padding?: string;
  behindActor?: Partial<BehindActorRequirement>;
}

/**
 * Opt-outs from features the engine treats as supported by default.
 * Every flag's default is `true` — a template only declares an entry
 * here when it does NOT support that feature (e.g. a template whose
 * layout would break if a per-word rotate were applied).
 */
export interface JsonFeaturesConfig {
  rotation?: { segment?: boolean; word?: boolean };
  behindActorOverride?: boolean;
}

// Full JSON schema for a template's template.json file. Splitter, alignment,
// rendering, and typography configs are partial; the loader fills missing
// fields with the system defaults. `segmentSplitters` is an ordered list —
// the deriver runs the entries left-to-right.
export interface JsonTemplateSchema {
  name: string;
  /** Free-form tags. The picker derives category tabs from the union. */
  categories?: string[];
  /**
   * Case-insensitive substrings matched against `navigator.userAgent`. If any
   * matches, the template is treated as unrenderable in the current browser.
   * Use to opt a template out of browsers where its CSS is known to render
   * incorrectly (e.g. `["Firefox"]`).
   */
  unsupportedUserAgents?: string[];
  styleControls?: ControlField[];
  typography?: Partial<TypographyConfig>;
  rotation?: Partial<RotationConfig>;
  segmentSplitters?: SegmentSplitterEntry[];
  lineSplitter?: Partial<LineSplitterConfig> & { type: LineSplitterConfig['type'] };
  alignment?: Partial<AlignmentConfig>;
  rendering?: JsonRenderingConfig;
  features?: JsonFeaturesConfig;
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
