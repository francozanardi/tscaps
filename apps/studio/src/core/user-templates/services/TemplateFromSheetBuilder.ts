import { SvgFilterDefinitions, SvgFilterDefinitionsParser } from '@tscaps/engine';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import type { StyleVariant, StyleVariants } from '@core/templates/domain/definition/StyleVariant';

export interface SheetSnapshotMetadata {
  readonly id: string;
  readonly name: string;
}

/**
 * Builds a fresh `Template` that reproduces a sheet's current styling
 * state. The sheet's typography, splitters, effects, css and
 * filters.svg are folded into the new template; styleControl values
 * are written into each control's `default` so applying the template
 * later seeds the same `StyleValues`.
 *
 * The parent's variants are kept, so the presets still tell speaker
 * sheets apart, but every value the user changed away from the active
 * preset is pinned into each of them. A variant is layered over the
 * defaults when the template is applied, so a parent preset left as it
 * was would overwrite the very values the snapshot saved — usually the
 * highlight colour, the control presets exist to vary.
 *
 * The new template carries the implicit `my templates` category so the
 * picker surfaces it under that tab, and inherits
 * `unsupportedBrowsers` from the sheet's source template — the css
 * limitations of the parent still apply to the snapshot.
 */
export class TemplateFromSheetBuilder {

  constructor(private readonly svgFilterDefinitionsParser: SvgFilterDefinitionsParser) {}

  build(sheet: Sheet, metadata: SheetSnapshotMetadata): Template {
    const filtersSvg = sheet.resolveFiltersSvg();
    return new Template(
      this.buildMetadata(sheet, metadata),
      sheet.typographyConfig,
      sheet.rotationConfig,
      sheet.alignmentConfig,
      sheet.template.rendering,
      sheet.template.features,
      sheet.template.behindActor,
      sheet.effectConfigs,
      sheet.segmentSplitterConfigs,
      sheet.lineSplitterConfig,
      this.foldCurrentValues(sheet.template.styleControls, sheet.styleValues.values),
      this.pinEditedValues(sheet),
      filtersSvg ? this.svgFilterDefinitionsParser.parse(filtersSvg) : SvgFilterDefinitions.empty(),
      sheet.resolveCss(),
      filtersSvg,
      [],
      sheet.template.fontStackIds,
    );
  }

  private buildMetadata(sheet: Sheet, metadata: SheetSnapshotMetadata): TemplateMetadata {
    return {
      id: metadata.id,
      name: metadata.name,
      category: sheet.template.metadata.category,
      unsupportedBrowsers: sheet.template.metadata.unsupportedBrowsers,
    };
  }

  private pinEditedValues(sheet: Sheet): StyleVariants {
    const variants = sheet.template.variants;
    if (variants.length === 0) return variants;
    const baseline = StyleValues.fromTemplateVariant(sheet.template, sheet.variantIndex).values;
    const current = sheet.styleValues.values;
    const edited: Record<string, ControlValue> = {};
    for (const fieldId of this.overriddenFieldIds(variants)) {
      const value = current[fieldId];
      if (value === undefined || this.sameValue(value, baseline[fieldId])) continue;
      edited[fieldId] = value;
    }
    return variants.map((variant): StyleVariant => ({
      label: variant.label,
      overrides: { ...variant.overrides, ...edited },
    }));
  }

  private overriddenFieldIds(variants: StyleVariants): Set<string> {
    return new Set(variants.flatMap((variant) => Object.keys(variant.overrides)));
  }

  // Font values are objects that come back from storage as fresh copies,
  // so identity alone would read an untouched font as edited.
  private sameValue(left: ControlValue, right: ControlValue | undefined): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private foldCurrentValues(
    controls: readonly ControlField[],
    values: Readonly<Record<string, ControlValue>>,
  ): ControlField[] {
    return controls.map((field) => this.snapshotField(field, values));
  }

  private snapshotField(
    field: ControlField,
    values: Readonly<Record<string, ControlValue>>,
  ): ControlField {
    const currentValue = values[field.id];
    if (currentValue === undefined) return field;
    return { ...field, default: currentValue };
  }
}
