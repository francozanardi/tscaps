import { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';
import { CaptionModeAssigner } from '@core/caption-modes/services/CaptionModeAssigner';
import { AssignCaptionModesAction } from '@core/caption-modes/actions/AssignCaptionModesAction';
import { TagConditionParser } from '@tscaps/engine';
import { TemplateSoundPlacer } from '@core/sheets/services/TemplateSoundPlacer';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { describe, expect, it } from 'vitest';
import { DocumentSheetElementResolver } from '@core/captions/services/DocumentSheetElementResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { SheetReadout } from '@core/editor-operations/services/SheetReadout';
import { ElementStyleReadout } from '@core/editor-operations/services/ElementStyleReadout';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { TemplateSwitchReadout } from '@core/editor-operations/services/TemplateSwitchReadout';
import { SetTemplateOperation } from '@core/editor-operations/services/descriptors/SetTemplateOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { SetTemplateAction } from '@core/sheets/actions/SetTemplateAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { Template } from '@core/templates/domain/Template';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

const project = new CaptionOperationsTestProject();
const plain = project.template({ id: 'plain' });
const bold = project.template({ id: 'bold' });
const behindThePerson = project.template({ id: 'behind', behindActorRequired: true });
const telemetry: Telemetry = { capture: () => {} };

/** Captions on `main` (active) and on `hook`, both on the plain template. */
function twoSheetProject(): EditorStore {
  const store = project.store([project.sheet('main', plain), project.sheet('hook', plain)]);
  store.patch({ availableTemplates: [plain, bold, behindThePerson] });
  return store;
}

function operationOn(store: EditorStore, saved: ReadonlyArray<Template> = []): SetTemplateOperation {
  const parser = new EditorRefParser();
  return new SetTemplateOperation(
    new SheetRefResolver(store, parser),
    store,
    new UserTemplatesStore(saved.map((template) => ({ template, parentTemplateId: null, createdAt: new Date(0), updatedAt: new Date(0) }))),
    parser,
    new ActiveSheetEditRunner(store, new SetActiveSheetAction(store)),
    new SetTemplateAction(
      store,
      project.inertRefresh(),
      { execute: () => {} } as unknown as RecordTemplateUseAction,
      telemetry,
      new LinkedSheetsSync(new LinkedSheetsPropagationNotifier()),
      new DocumentSheetElementResolver(store),
      new TemplateSoundPlacer(new AudioClipDefaults(), new TagConditionParser()),
      new AssignCaptionModesAction(new CaptionModeAssigner(new ModeMatcherRegistry(new TagConditionParser()))),
    ),
    new CaptionReflowDetector(),
    new TemplateSwitchReadout(new SheetReadout(parser, new ElementStyleReadout(new ReadoutFormatter()), new ReadoutFormatter())),
  );
}

function templateOf(store: EditorStore, sheetId: string): string | undefined {
  return store.sheet(sheetId)?.template.metadata.id;
}

describe('set_template', () => {
  it('applies the template to the sheet named and leaves the active sheet on screen', async () => {
    const store = twoSheetProject();

    const result = await operationOn(store).run({ template: 'bold', sheet: 'sheet:hook' });

    expect(result.output).toEqual({ sheet: 'sheet:hook', template: 'bold' });
    expect([templateOf(store, 'main'), templateOf(store, 'hook')]).toEqual(['plain', 'bold']);
    expect(store.snapshot().activeSheetId).toBe('main');
  });

  it('clears the styles of the captions under that sheet alone, and says so', async () => {
    const store = twoSheetProject();
    const styles = store.snapshot().elementStyles.withCss('w1', 'word', 'color: red;').withCss('w5', 'word', 'color: red;');
    store.patch({ elementStyles: styles });

    const result = await operationOn(store).run({ template: 'bold', sheet: 'sheet:hook' });

    expect(store.snapshot().elementStyles.has('w1')).toBe(true);
    expect(store.snapshot().elementStyles.has('w5')).toBe(false);
    expect(result.problems.some((problem) => problem.severity === 'warning' && problem.message.includes('cleared'))).toBe(true);
  });

  it('applies one of the person\'s saved templates', async () => {
    const store = twoSheetProject();

    await operationOn(store, [project.template({ id: 'mine' })]).run({ template: 'mine' });

    expect(templateOf(store, 'main')).toBe('mine');
  });

  it('refuses a template that does not exist, naming some that do, and changes nothing', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ template: 'nope' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('bold');
    expect(store.snapshot()).toBe(before);
  });

  it('says what the switch undid of what had been set on the sheet, and nothing the templates merely differ in', async () => {
    const text: ControlField = { id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff' };
    const lowercaseOff: EffectConfig = { type: 'smart_lowercase', enabled: false };
    const punctuationKept: EffectConfig = { type: 'remove_punctuation', enabled: false };
    const calm = project.template({ id: 'calm', styleControls: [text], effects: [lowercaseOff, punctuationKept] });
    // Drops punctuation on its own: nobody asked for it to be kept, so nothing asked for is lost.
    const loud = project.template({ id: 'loud', styleControls: [text], effects: [lowercaseOff, { ...punctuationKept, enabled: true }] });
    const asked = project.sheet('main', calm).with({ effectConfigs: [{ ...lowercaseOff, enabled: true }, punctuationKept] });
    const store = project.store([asked.with({
      alignmentConfig: { ...asked.alignmentConfig, verticalAlign: 'top' },
      styleValues: asked.styleValues.withValue(text, '#ffe600'),
    })]);
    store.patch({ availableTemplates: [calm, loud] });

    const result = await operationOn(store).run({ template: 'loud' });

    expect(result.problems).toContainEqual({
      severity: 'warning',
      message: 'sheet:main is on loud now, which undid what had been set on it: lowercase on → off, verticalAlign top → bottom, primary-color #ffe600 → #ffffff.',
    });
  });

  it('says nothing was undone on a sheet that had nothing of its own set', async () => {
    const result = await operationOn(twoSheetProject()).run({ template: 'bold' });

    expect(result.problems.filter((problem) => problem.message.includes('undid'))).toEqual([]);
  });

  it('refuses a template that puts captions behind the person, which needs the person\'s consent', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ template: 'behind' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});
