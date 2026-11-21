import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { SetStyleControlsOperation } from '@core/editor-operations/services/descriptors/SetStyleControlsOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { UpdateStyleControlAction } from '@core/sheets/actions/style/UpdateStyleControlAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { ControlField } from '@core/templates/domain/definition/ControlField';

const CONTROLS: ReadonlyArray<ControlField> = [
  { id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff' },
  { id: 'size', label: 'Size', type: 'float', default: 5, min: 2, max: 12, unit: 'cqh' },
  { id: 'caps', label: 'Caps', type: 'toggle', default: false },
  { id: 'mask', label: 'Brush image', type: 'image', default: 'marker-stroke' },
  { id: 'accent-font', label: 'Accent font', type: 'font', default: new FontStackLibrary().stackFor('inter').toSnapshot() },
];
const project = new CaptionOperationsTestProject();
const dialled = project.template({ id: 'dialled', styleControls: CONTROLS });

/** Captions on `main` (active) and on `hook`, both on a template with the controls above. */
function twoSheetProject(): EditorStore {
  return project.store([project.sheet('main', dialled), project.sheet('hook', dialled)]);
}

function operationOn(store: EditorStore): SetStyleControlsOperation {
  const parser = new EditorRefParser();
  const updateControl = new UpdateStyleControlAction(store, project.inertRefresh(), new LinkedSheetsSync(new LinkedSheetsPropagationNotifier()));
  return new SetStyleControlsOperation(
    new SheetRefResolver(store, parser),
    store,
    parser,
    new ActiveSheetEditRunner(store, new SetActiveSheetAction(store)),
    updateControl,
    new FontStackLibrary(),
    project.inertRefresh(),
    new CaptionReflowDetector(),
  );
}

describe('set_style_controls', () => {
  it('sets the controls of the sheet named and leaves the active sheet on screen', async () => {
    const store = twoSheetProject();

    const result = await operationOn(store).run({ values: { 'primary-color': '#ffd400', size: 8, caps: true }, sheet: 'sheet:hook' });

    expect(result.output).toEqual({ sheet: 'sheet:hook', changed: ['primary-color', 'size', 'caps'] });
    expect(store.sheet('hook')?.styleValues.values).toMatchObject({ 'primary-color': '#ffd400', size: 8, caps: true });
    expect(store.sheet('main')?.styleValues.values['primary-color']).toBe('#ffffff');
    expect(store.snapshot().activeSheetId).toBe('main');
  });

  it('refuses a control the template does not have, naming the ones it has', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ values: { colour: '#ffd400' } });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('primary-color');
    expect(store.snapshot()).toBe(before);
  });

  it('refuses values out of a control\'s range or of the wrong kind, writing none of the call', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ values: { size: 40, 'primary-color': 'gold', caps: true } });

    expect(result.problems).toHaveLength(2);
    expect(store.snapshot()).toBe(before);
  });

  it('writes nothing for a value the control already holds', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ values: { 'primary-color': '#ffffff' } });

    expect(result.output).toEqual({ sheet: 'sheet:main', changed: [] });
    expect(store.snapshot()).toBe(before);
  });

  it('refuses an image control, changing nothing', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ values: { mask: 'my-brush' } });

    expect(result.problems[0]?.message).toBe('mask is an image control, which cannot be set here.');
    expect(store.snapshot()).toBe(before);
  });

  it('sets a font control to a catalog font for every alphabet, and refuses one the catalog lacks', async () => {
    const store = twoSheetProject();
    const operation = operationOn(store);

    const set = await operation.run({ values: { 'accent-font': 'Bebas Neue' } });
    const refused = await operation.run({ values: { 'accent-font': 'Comic Sans' } });

    expect([set.ok, refused.ok]).toEqual([true, false]);
    expect(store.sheet('main')?.styleValues.values['accent-font']).toEqual(new FontStackLibrary().stackLedBy('Bebas Neue').toSnapshot());
  });
});
