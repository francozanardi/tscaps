import { describe, expect, it } from 'vitest';
import { MoveToSheetOperation } from '@core/editor-operations/services/descriptors/MoveToSheetOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): MoveToSheetOperation {
  const { store, parser, sheetRefs, sceneRefs, reflow, actions } = fixture;
  return new MoveToSheetOperation(store, parser, sheetRefs, sceneRefs, reflow, actions.assignScenes);
}

describe('move_to_sheet', () => {
  it('moves the scenes onto the sheet named, and back to main', async () => {
    const fixture = new SheetOperationsFixture();

    const moved = await operationOn(fixture).run({ segments: ['segment:s1'], sheet: 'sheet:other' });
    expect(moved.output).toMatchObject({ sheet: 'sheet:other', scenesMoved: 1 });
    expect(fixture.sheetOfWord('w1')).toBe('other');

    await operationOn(fixture).run({ segments: ['segment:s1'], sheet: 'sheet:main' });
    expect(fixture.sheetOfWord('w1')).toBe('main');
  });

  it('refuses a sheet that is not in the project', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ segments: ['segment:s1'], sheet: 'sheet:nope' });

    expect(result.ok).toBe(false);
    expect(fixture.sheetOfWord('w1')).toBe('main');
  });
});
