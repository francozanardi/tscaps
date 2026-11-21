import { describe, expect, it } from 'vitest';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { Template } from '@core/templates/domain/Template';
import { ResetSheetMotionAction } from '@core/sheets/actions/style/ResetSheetMotionAction';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * Putting one kind back to the way its template moves it.
 *
 * A sheet can say three different things about the same movement — it
 * replaced the animation, it tuned the one already there, it moved a
 * control the template's own keyframes read — and usually some of each.
 * Undoing one and leaving the others is a state the user never chose,
 * so the button either clears all of them for that kind or nothing.
 *
 * And only for that kind. Answers about the words are not answers
 * about the captions, however alike the two panels look.
 */

const WORDS = ElementAnimationScope.WORDS;
const SEGMENTS = ElementAnimationScope.SEGMENTS;

const PILL_GROW: ControlField = {
  id: 'pill-grow', label: 'Pill pop', type: 'float', default: 0.05, group: 'motion', subgroup: 'words',
};
const SCENE_RISE: ControlField = {
  id: 'scene-rise', label: 'Rise', type: 'float', default: 0.5, group: 'motion', subgroup: 'segments',
};
const TEXT_COLOR: ControlField = {
  id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff', group: 'style', subgroup: 'colors',
};

const CONTROLS = [PILL_GROW, SCENE_RISE, TEXT_COLOR];

const template = { styleControls: CONTROLS, variants: [], modes: BODY_ONLY_MODES } as unknown as Template;

const linkedSheetsSync = {
  applyStyleEdit: (updated: Sheet, sheets: ReadonlyArray<Sheet>) =>
    sheets.map((sheet) => (sheet.id === updated.id ? updated : sheet)),
} as unknown as LinkedSheetsSync;

const refresh = { execute: () => {} } as unknown as RefreshDocumentAction;

const TUNED = { kind: 'tuned', values: { '--entrance-rise': { kind: 'number', amount: 1, unit: 'em' } }, css: '.word{}' } as const;

function sheetWith(animations: SheetAnimationSet, styleValues: StyleValues): Sheet {
  return new Sheet({
    id: 'main',
    name: 'Main',
    color: null,
    template,
    variantIndex: 0,
    styleValues,
    typographyConfig: TYPOGRAPHY_DEFAULTS,
    rotationConfig: ROTATION_DEFAULTS,
    segmentSplitterConfigs: [],
    lineSplitterConfig: { mode: 'none' } as never,
    alignmentConfig: { verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0 },
    effectConfigs: [],
    animations,
  });
}

function storeShowing(animations: SheetAnimationSet, styleValues: StyleValues): EditorStore {
  const store = new EditorStore();
  store.patch({ sheets: [sheetWith(animations, styleValues)], activeSheetId: 'main' });
  return store;
}

function activeSheet(store: EditorStore): Sheet {
  return store.snapshot().sheets[0]!;
}

const shipped = () => StyleValues.fromTemplate(CONTROLS);

describe('resetting one kind of movement', () => {
  it('drops the animation the sheet put in its place', () => {
    const answered = SheetAnimationSet.empty()
      .with(WORDS, { kind: 'replaced', animation: { presetId: 'rise-in', params: {} }, css: '.word{}' });
    const store = storeShowing(answered, shipped());

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).animations.get(WORDS)).toBeNull();
  });

  it('drops the tuning of the animation the template already had', () => {
    const store = storeShowing(SheetAnimationSet.empty().with(WORDS, TUNED), shipped());

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).animations.get(WORDS)).toBeNull();
  });

  it('puts the template\'s own motion controls for that kind back', () => {
    const moved = shipped().withValue(PILL_GROW, 0.25);
    const store = storeShowing(SheetAnimationSet.empty(), moved);

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).styleValues.values['pill-grow']).toBe(0.05);
  });

  it('leaves a motion control belonging to another kind alone', () => {
    const moved = shipped().withValue(SCENE_RISE, 1.2);
    const store = storeShowing(SheetAnimationSet.empty(), moved);

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).styleValues.values['scene-rise']).toBe(1.2);
  });

  it('leaves the look alone, however much of it the animation shows off', () => {
    const moved = shipped().withValue(TEXT_COLOR, '#ff0000');
    const store = storeShowing(SheetAnimationSet.empty(), moved);

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).styleValues.values['primary-color']).toBe('#ff0000');
  });

  it('clears the animation and the controls together, not one of the two', () => {
    const answered = SheetAnimationSet.empty()
      .with(WORDS, { kind: 'replaced', animation: { presetId: 'rise-in', params: {} }, css: '.word{}' });
    const store = storeShowing(answered, shipped().withValue(PILL_GROW, 0.25));

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).animations.get(WORDS)).toBeNull();
    expect(activeSheet(store).styleValues.values['pill-grow']).toBe(0.05);
  });

  it('leaves another kind\'s answer standing', () => {
    const answered = SheetAnimationSet.empty()
      .with(WORDS, { kind: 'replaced', animation: { presetId: 'rise-in', params: {} }, css: '.word{}' })
      .with(SEGMENTS, { kind: 'replaced', animation: { presetId: 'fade-in', params: {} }, css: '.segment{}' });
    const store = storeShowing(answered, shipped());

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store).animations.get(SEGMENTS)).not.toBeNull();
  });

  it('touches nothing when the kind is already as the template has it', () => {
    const store = storeShowing(SheetAnimationSet.empty(), shipped());
    const before = activeSheet(store);

    new ResetSheetMotionAction(store, refresh, linkedSheetsSync).execute(WORDS);

    expect(activeSheet(store)).toBe(before);
  });
});
