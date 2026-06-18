import { SvgFilterDefinitions, SvgFilterDefinitionsParser } from '@tscaps/engine';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { Sheet } from '@core/sheets/domain/Sheet';

export const USER_TEMPLATE_CATEGORY = 'my templates';

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
 * The new template carries the implicit `my templates` category so the
 * picker surfaces it under that tab, and inherits
 * `unsupportedUserAgents` from the sheet's source template — the css
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
      sheet.effectConfigs,
      sheet.segmentSplitterConfigs,
      sheet.lineSplitterConfig,
      this.foldCurrentValues(sheet.template.styleControls, sheet.styleValues.values),
      sheet.template.variants,
      filtersSvg ? this.svgFilterDefinitionsParser.parse(filtersSvg) : SvgFilterDefinitions.empty(),
      sheet.resolveCss(),
      filtersSvg,
    );
  }

  private buildMetadata(sheet: Sheet, metadata: SheetSnapshotMetadata): TemplateMetadata {
    return {
      id: metadata.id,
      name: metadata.name,
      categories: [USER_TEMPLATE_CATEGORY],
      unsupportedUserAgents: sheet.template.metadata.unsupportedUserAgents,
    };
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
