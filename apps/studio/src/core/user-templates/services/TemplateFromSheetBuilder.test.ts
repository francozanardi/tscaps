import { describe, expect, it } from 'vitest';
import { SvgFilterDefinitionsParser } from '@tscaps/engine';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { StyleVariants } from '@core/templates/domain/definition/StyleVariant';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { TemplateFromSheetBuilder } from '@core/user-templates/services/TemplateFromSheetBuilder';

/**
 * Saving a sheet as a template of one's own, from a template whose
 * presets each set their own highlight colour.
 */

const CONTROLS: ControlField[] = [
  { id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff', group: 'style', subgroup: 'colors' },
  { id: 'highlight-color', label: 'Highlight', type: 'color', default: '#ffea00', group: 'style', subgroup: 'colors' },
];

const PRESETS: StyleVariants = [
  { label: 'Yellow', overrides: { 'highlight-color': '#ffea00', 'primary-color': '#ffffff' } },
  { label: 'Cyan', overrides: { 'highlight-color': '#00e5ff', 'primary-color': '#eeeeee' } },
];

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

const builtIn = new Template(
  { id: 'built-in', name: 'Built-in', category: 'lab' } as unknown as TemplateMetadata,
  TYPOGRAPHY_DEFAULTS,
  ROTATION_DEFAULTS,
  ALIGNMENT,
  {} as RenderingConfig,
  {} as FeaturesConfig,
  {} as BehindActorTemplateConfig,
  [],
  [],
  { mode: 'none' } as unknown as LineSplitterConfig,
  CONTROLS,
  PRESETS,
  {} as SvgFilterDefinitions,
  '',
  '',
  [],
);

function sheetOn(template: Template, variantIndex: number): Sheet {
  return new Sheet({
    id: `sheet-${variantIndex}`,
    name: 'Sheet',
    color: null,
    template,
    variantIndex,
    styleValues: StyleValues.fromTemplateVariant(template, variantIndex),
    typographyConfig: TYPOGRAPHY_DEFAULTS,
    rotationConfig: ROTATION_DEFAULTS,
    segmentSplitterConfigs: [],
    lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
    alignmentConfig: ALIGNMENT,
    effectConfigs: [],
  });
}

function withHighlight(sheet: Sheet, color: string): Sheet {
  const field = CONTROLS.find((control) => control.id === 'highlight-color')!;
  return sheet.with({ styleValues: sheet.styleValues.withValue(field, color) });
}

function saved(sheet: Sheet): Template {
  return new TemplateFromSheetBuilder(new SvgFilterDefinitionsParser()).build(sheet, { id: 'mine', name: 'Mine' });
}

describe('saving a sheet as a template', () => {
  it('keeps the highlight colour the user picked when the template is applied', () => {
    const mine = saved(withHighlight(sheetOn(builtIn, 0), '#ff0000'));

    const applied = sheetOn(builtIn, 0).withTemplate(mine);

    expect(applied.styleValues.values['highlight-color']).toBe('#ff0000');
  });

  it('reproduces the saved look on the preset it was saved from', () => {
    const edited = withHighlight(sheetOn(builtIn, 1), '#ff0000');

    const applied = sheetOn(builtIn, 1).withTemplate(saved(edited));

    expect(applied.styleValues.values).toEqual(edited.styleValues.values);
  });

  it('keeps the edit on every preset while the rest still tells them apart', () => {
    const mine = saved(withHighlight(sheetOn(builtIn, 0), '#ff0000'));

    const speakers = [0, 1].map((index) => sheetOn(builtIn, index).withTemplate(mine));

    expect(speakers.map((sheet) => sheet.styleValues.values['highlight-color'])).toEqual(['#ff0000', '#ff0000']);
    expect(speakers.map((sheet) => sheet.styleValues.values['primary-color'])).toEqual(['#ffffff', '#eeeeee']);
  });

  it('leaves the presets as they were when nothing was changed', () => {
    const mine = saved(sheetOn(builtIn, 1));

    expect(mine.variants).toEqual(PRESETS);
  });
});
