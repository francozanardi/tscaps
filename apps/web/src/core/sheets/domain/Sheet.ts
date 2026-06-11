import type { AlignmentConfig } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { StyleValues } from '@core/sheets/domain/StyleValues';

export const MAIN_SHEET_ID = 'main';

export interface SheetProps {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly template: Template;
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
   * (CSS and filters.svg) to template defaults.
   */
  withTemplate(template: Template): Sheet {
    return this.with({
      template,
      styleValues: StyleValues.fromTemplate(template.styleControls),
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
   * Builds a Sheet from a Template, using the template's defaults for every
   * styling field. Used when creating a new sheet or bootstrapping `main`.
   */
  static fromTemplate(id: string, name: string, color: string | null, template: Template): Sheet {
    return new Sheet({
      id,
      name,
      color,
      template,
      styleValues: StyleValues.fromTemplate(template.styleControls),
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
}
