import { describe, expect, it } from 'vitest';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { StyleVariants } from '@core/templates/domain/definition/StyleVariant';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { Template } from '@core/templates/domain/Template';
import { SetTemplateAction } from '@core/sheets/actions/SetTemplateAction';
import type { ControlValue } from '@core/templates/domain/definition/ControlField';

/**
 * Trying out a template, from a project whose sheets stand for speakers.
 *
 * Each speaker sheet is pinned to a different preset, and most templates
 * ship no presets at all. So the pick that shows every speaker the same
 * look has to be a view of the moment, not a decision written down: the
 * speakers were told apart before it and are told apart again after it.
 */

const TEXT_COLOR: ControlField = {
  id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff', group: 'style', subgroup: 'colors',
};

const CONTROLS = [TEXT_COLOR];

const THREE_PRESETS: StyleVariants = [
  { label: 'A', overrides: { 'primary-color': '#aaaaaa' } },
  { label: 'B', overrides: { 'primary-color': '#bbbbbb' } },
  { label: 'C', overrides: { 'primary-color': '#cccccc' } },
];

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

function templateShipping(id: string, variants: StyleVariants): Template {
  return new Template(
    { id, category: 'lab' } as unknown as TemplateMetadata,
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
    variants,
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
}

const withPresets = templateShipping('with-presets', THREE_PRESETS);
const withoutPresets = templateShipping('without-presets', []);

function speakerSheet(id: string, template: Template, variantIndex: number): Sheet {
  return new Sheet({
    id,
    name: id,
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
    linkGroupId: 'speakers',
  });
}

/** Three linked speaker sheets, each on its own preset of the same template. */
function storeShowingThreeSpeakers(): EditorStore {
  const store = new EditorStore();
  store.patch({
    sheets: [
      speakerSheet('main', withPresets, 0),
      speakerSheet('speaker-2', withPresets, 1),
      speakerSheet('speaker-3', withPresets, 2),
    ],
    activeSheetId: 'main',
  });
  return store;
}

const noElementsResolver: SheetElementResolver = { elementsOf: () => new Set() };

function actionOn(store: EditorStore): SetTemplateAction {
  return new SetTemplateAction(
    store,
    { execute: () => {} } as unknown as RefreshDocumentAction,
    { execute: () => {} } as unknown as RecordTemplateUseAction,
    { capture: () => {} } as unknown as Telemetry,
    new LinkedSheetsSync(new LinkedSheetsPropagationNotifier()),
    noElementsResolver,
  );
}

function textColors(store: EditorStore): (ControlValue | null)[] {
  return store.snapshot().sheets.map((sheet) => sheet.styleValues.values['primary-color'] ?? null);
}

describe('picking a template for a group of speaker sheets', () => {
  it('shows every speaker the same look while the template has no presets', () => {
    const store = storeShowingThreeSpeakers();

    actionOn(store).execute(withoutPresets);

    expect(textColors(store)).toEqual(['#ffffff', '#ffffff', '#ffffff']);
  });

  it('gives each speaker its own preset back on a template that has them', () => {
    const store = storeShowingThreeSpeakers();
    const action = actionOn(store);

    action.execute(withoutPresets);
    action.execute(withPresets);

    expect(textColors(store)).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc']);
  });

  it('keeps a speaker past the last preset apart from the first once presets are plentiful', () => {
    const store = new EditorStore();
    store.patch({
      sheets: [speakerSheet('main', withoutPresets, 0), speakerSheet('speaker-4', withoutPresets, 3)],
      activeSheetId: 'main',
    });

    actionOn(store).execute(templateShipping('four-presets', [
      ...THREE_PRESETS,
      { label: 'D', overrides: { 'primary-color': '#dddddd' } },
    ]));

    expect(textColors(store)).toEqual(['#aaaaaa', '#dddddd']);
  });
});
