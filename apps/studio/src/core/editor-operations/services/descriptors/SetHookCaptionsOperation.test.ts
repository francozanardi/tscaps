import { describe, expect, it } from 'vitest';
import { SetHookCaptionsOperation } from '@core/editor-operations/services/descriptors/SetHookCaptionsOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';
import { HOOK_SHEET_ID } from '@core/sheets/domain/Sheet';

function operationOn(fixture: SheetOperationsFixture): SetHookCaptionsOperation {
  const { store, parser, sceneRefs, reflow, actions } = fixture;
  return new SetHookCaptionsOperation(store, parser, sceneRefs, reflow, actions.setHookScenes, actions.setActive);
}

describe('set_hook_captions', () => {
  it('puts the opening scene on a new hook sheet, keeps the sheet on screen, and removes the hook on an empty list', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ segments: ['segment:s1'] });
    expect(result.output).toMatchObject({ hook: `sheet:${HOOK_SHEET_ID}` });
    expect(fixture.sheetOfWord('w1')).toBe(HOOK_SHEET_ID);
    expect(fixture.store.snapshot().activeSheetId).toBe('main');

    await operationOn(fixture).run({ segments: [] });
    expect(fixture.sheetOfWord('w1')).toBe('main');
    expect(fixture.store.sheet(HOOK_SHEET_ID)).toBeNull();
  });

  it('refuses scenes that are not the opening ones in a row', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ segments: ['segment:s2'] });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('segment:s1');
    expect(fixture.store.sheet(HOOK_SHEET_ID)).toBeNull();
  });
});
