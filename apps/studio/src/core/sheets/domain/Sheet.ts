import type { AlignmentConfig } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { StyleValues } from '@core/sheets/domain/StyleValues';

export const MAIN_SHEET_ID = 'main';
export const HOOK_SHEET_ID = 'hook';

export interface SheetProps {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly template: Template;
  readonly variantIndex: number;
  readonly styleValues: StyleValues;
  readonly typographyConfig: TypographyConfig;
  readonly rotationConfig: RotationConfig;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  readonly lineSplitterConfig: LineSplitterConfig;
  readonly alignmentConfig: AlignmentConfig;
  readonly effectConfigs: ReadonlyArray<EffectConfig>;
  readonly cssOverride?: string | null | undefined;
  readonly filtersSvgOverride?: string | null | undefined;
}

/**
 * A Sheet groups a Template with the current styling state: control
 * values, splitter configs, alignment, typography, and effects. It also
 * carries identity (id, name, color) so the user can label it in the UI.
 *
 * Sheet assignment lives in `Section.kind`: each Section's `kind` is the
 * id of the Sheet whose pipeline should process its segments. The deriver
 * re-pipes each Section under its sheet's rules to produce the derived
 * Section. See `docs/DOCUMENT_ARCHITECTURE.md` on why there is no
 * separate raw document.
 *
 * Immutable: every mutation returns a new instance.
 */
export class Sheet {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly template: Template;
  readonly variantIndex: number;
  readonly styleValues: StyleValues;
  readonly typographyConfig: TypographyConfig;
  readonly rotationConfig: RotationConfig;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  readonly lineSplitterConfig: LineSplitterConfig;
  readonly alignmentConfig: AlignmentConfig;
  readonly effectConfigs: ReadonlyArray<EffectConfig>;
  readonly cssOverride: string | null;
  readonly filtersSvgOverride: string | null;

  constructor(props: SheetProps) {
    this.id = props.id;
    this.name = props.name;
    this.color = props.color;
    this.template = props.template;
    this.variantIndex = props.variantIndex;
    this.styleValues = props.styleValues;
    this.typographyConfig = props.typographyConfig;
    this.rotationConfig = props.rotationConfig;
    this.segmentSplitterConfigs = props.segmentSplitterConfigs;
    this.lineSplitterConfig = props.lineSplitterConfig;
    this.alignmentConfig = props.alignmentConfig;
    this.effectConfigs = props.effectConfigs;
    this.cssOverride = props.cssOverride ?? null;
    this.filtersSvgOverride = props.filtersSvgOverride ?? null;
  }

  with(changes: Partial<SheetProps>): Sheet {
    return new Sheet({
      id: this.id,
      name: this.name,
      color: this.color,
      template: this.template,
      variantIndex: this.variantIndex,
      styleValues: this.styleValues,
      typographyConfig: this.typographyConfig,
      rotationConfig: this.rotationConfig,
      segmentSplitterConfigs: this.segmentSplitterConfigs,
      lineSplitterConfig: this.lineSplitterConfig,
      alignmentConfig: this.alignmentConfig,
      effectConfigs: this.effectConfigs,
      cssOverride: this.cssOverride,
      filtersSvgOverride: this.filtersSvgOverride,
      ...changes,
    });
  }

  /**
   * Applies a new Template, resetting style values, typography, splitter
   * configs, alignment, effects, and any user-edited source overrides
   * (CSS and filters.svg) to template defaults. The current
   * `variantIndex` carries over (modulo the new template's variant
   * count) so a sheet representing "the second preset" stays on the
   * second preset of whichever template it lands on; templates with
   * no variants reset the index to 0.
   */
  withTemplate(template: Template): Sheet {
    const variantIndex = template.variants.length > 0
      ? this.variantIndex % template.variants.length
      : 0;
    return this.with({
      template,
      variantIndex,
      styleValues: StyleValues.fromTemplateVariant(template, variantIndex),
      typographyConfig: template.typography,
      rotationConfig: template.rotation,
      segmentSplitterConfigs: template.segmentSplitterConfigs,
      lineSplitterConfig: template.lineSplitter,
      alignmentConfig: template.alignment,
      effectConfigs: template.effectConfigs,
      cssOverride: null,
      filtersSvgOverride: null,
    });
  }

  /**
   * Re-seeds `styleValues` from the current template defaults plus the
   * picked variant's overrides. Manual per-field edits made before the
   * switch are dropped — switching variant follows the same
   * "preset replaces local edits" rule as switching template. Indices
   * are wrapped into a valid slot; templates without variants behave
   * as `variantIndex = 0`.
   */
  withVariant(variantIndex: number): Sheet {
    const count = this.template.variants.length;
    if (count === 0) {
      return this.with({
        variantIndex: 0,
        styleValues: StyleValues.fromTemplateVariant(this.template, 0),
      });
    }
    const safeIndex = ((variantIndex % count) + count) % count;
    return this.with({
      variantIndex: safeIndex,
      styleValues: StyleValues.fromTemplateVariant(this.template, safeIndex),
    });
  }

  /**
   * The persisted config for the effect of the given type, or `null`
   * when the sheet does not carry one. Consumers read `.enabled` for
   * the runtime toggle and the type-specific fields for parameters.
   * UI surfaces that need a sensible fallback to render an off-state
   * control layer the registry's `defaultConfig` on top of this.
   */
  effectConfig<T extends EffectConfig['type']>(type: T): Extract<EffectConfig, { type: T }> | null {
    for (const config of this.effectConfigs) {
      if (config.type === type) return config as Extract<EffectConfig, { type: T }>;
    }
    return null;
  }

  /**
   * The CSS to apply to this sheet's overlay/export. Returns the user's
   * edited copy when present, otherwise the template's pristine CSS.
   */
  resolveCss(): string {
    return this.cssOverride ?? this.template.getCss();
  }

  /**
   * The raw `filters.svg` source to apply to this sheet. Returns the
   * user's edited copy when present, otherwise the template's pristine
   * filters source (empty string when the template ships none).
   */
  resolveFiltersSvg(): string {
    return this.filtersSvgOverride ?? this.template.getFiltersSvg();
  }

  /**
   * Builds a Sheet from a Template, using the template's defaults
   * (with the first variant's overrides layered in, when the template
   * ships variants) for every styling field. Used when creating a new
   * sheet or bootstrapping `main`.
   */
  static fromTemplate(id: string, name: string, color: string | null, template: Template): Sheet {
    return new Sheet({
      id,
      name,
      color,
      template,
      variantIndex: 0,
      styleValues: StyleValues.fromTemplateVariant(template, 0),
      typographyConfig: template.typography,
      rotationConfig: template.rotation,
      segmentSplitterConfigs: template.segmentSplitterConfigs,
      lineSplitterConfig: template.lineSplitter,
      alignmentConfig: template.alignment,
      effectConfigs: template.effectConfigs,
    });
  }

  /**
   * Builds the canonical `main` Sheet (id, name, and color fixed) from a
   * Template. Centralises these literals so every entry point that resets
   * the editing session — startup, new-video upload, video clear — produces
   * an identical baseline.
   *
   * The color is a mid-neutral (slate-400) so the swatch and any chip/edge
   * accents painted with it stay legible on both the cream light theme and
   * the near-black dark theme — the previous slate-200 disappeared on cream.
   */
  static createMain(template: Template): Sheet {
    return Sheet.fromTemplate(MAIN_SHEET_ID, 'Main', '#94a3b8', template);
  }

  /**
   * Builds the canonical `hook` Sheet (id, name, and color fixed) from a
   * Template. The color is a warm amber so the chip stands out from the
   * slate Main swatch on both themes.
   */
  static createHook(template: Template): Sheet {
    return Sheet.fromTemplate(HOOK_SHEET_ID, 'Hook', '#EBB85C', template);
  }
}
