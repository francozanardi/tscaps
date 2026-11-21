import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { SetCaptionTypographyOperation } from '@core/editor-operations/services/descriptors/SetCaptionTypographyOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { UpdateSheetVariantAction } from '@core/sheets/actions/style/UpdateSheetVariantAction';
import { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

const project = new CaptionOperationsTestProject();
const plain = project.template({ id: 'plain' });

/** Captions on `main` (active) and on `hook`. */
function twoSheetProject(): EditorStore {
  return project.store([project.sheet('main', plain), project.sheet('hook', plain)]);
}

function operationOn(store: EditorStore): SetCaptionTypographyOperation {
  const parser = new EditorRefParser();
  return new SetCaptionTypographyOperation(
    new SheetRefResolver(store, parser),
    store,
    parser,
    new FontStackLibrary(),
    new ActiveSheetEditRunner(store, new SetActiveSheetAction(store)),
    new UpdateTypographyAction(store, project.inertRefresh(), new LinkedSheetsSync(new LinkedSheetsPropagationNotifier())),
    new UpdateSheetVariantAction(store, project.inertRefresh()),
    project.inertRefresh(),
    new CaptionReflowDetector(),
  );
}

describe('set_caption_typography', () => {
  it('sets the font and the size of the sheet named, leaving the other sheet as it was', async () => {
    const store = twoSheetProject();

    const result = await operationOn(store).run({ sheet: 'sheet:hook', font: 'anton', sizeCqh: 6, case: 'uppercase' });

    expect(result.output).toEqual({ sheet: 'sheet:hook', changed: ['fontStack', 'fontSize', 'textCase'] });
    const hook = store.sheet('hook')?.typographyConfig;
    expect([hook?.fontStack.familyFor('latin'), hook?.fontSize, hook?.textCase]).toEqual(['Anton', 6, 'uppercase']);
    expect(store.sheet('main')?.typographyConfig).toEqual(plain.typography);
  });

  it('refuses a font the catalog does not have, naming the ones it has, and changes nothing', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ font: 'Comic Sans', sizeCqh: 6 });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('Inter Variable');
    expect(store.snapshot()).toBe(before);
  });
});
