import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { SetCaptionPositionOperation } from '@core/editor-operations/services/descriptors/SetCaptionPositionOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { LinkSheetAction } from '@core/sheets/actions/LinkSheetAction';
import { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { Template } from '@core/templates/domain/Template';

const project = new CaptionOperationsTestProject();
const turning = project.template({ id: 'turning', css: '.segment { rotate: var(--tscaps-rotation, 0deg); }' });
const sync = new LinkedSheetsSync(new LinkedSheetsPropagationNotifier());

/** Captions on `main` (active) and on `other`, both on `template`. */
function twoSheetProject(template: Template = turning): EditorStore {
  return project.store([project.sheet('main', template), project.sheet('other', template)]);
}

function operationOn(store: EditorStore): SetCaptionPositionOperation {
  const parser = new EditorRefParser();
  return new SetCaptionPositionOperation(
    new SheetRefResolver(store, parser),
    parser,
    new UpdateAlignmentAction(store, sync),
    new UpdateRotationAction(store, sync),
  );
}

describe('set_caption_position', () => {
  it('places and turns the sheet named, and the sheets linked to it follow', async () => {
    const store = twoSheetProject();
    new LinkSheetAction(store, project.inertRefresh(), sync).execute('other', 'main');

    const result = await operationOn(store).run({
      sheet: 'sheet:main', verticalAlign: 'top', verticalOffset: 0.1, horizontalAlign: 'start', horizontalOffset: 0.06, rotationDeg: -8,
    });

    expect(result).toEqual({
      ok: true,
      output: { sheet: 'sheet:main', changed: ['verticalAlign', 'verticalOffset', 'horizontalAlign', 'horizontalOffset', 'rotationDeg'] },
      problems: [],
    });
    for (const id of ['main', 'other']) {
      const sheet = store.sheet(id);
      expect([sheet?.alignmentConfig, sheet?.rotationConfig.angleDeg]).toEqual([
        { verticalAlign: 'top', verticalOffset: 0.1, horizontalAlign: 'start', horizontalOffset: 0.06 },
        -8,
      ]);
    }
  });

  it('refuses to move a vertical anchor the template holds, and changes nothing', async () => {
    const store = twoSheetProject(project.template({ id: 'held', holdsVerticalAnchor: true }));
    const before = store.snapshot();

    const result = await operationOn(store).run({ verticalAlign: 'top', verticalOffset: 0.1 });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('turns the captions, and warns that it draws nothing when the sheet\'s CSS never reads the rotation', async () => {
    const store = twoSheetProject(project.template({ id: 'still', css: '.segment { color: white; }' }));

    const result = await operationOn(store).run({ rotationDeg: 12 });

    expect(store.sheet('main')?.rotationConfig.angleDeg).toBe(12);
    expect(result.problems.map((problem) => problem.severity)).toEqual(['warning']);
  });
});
