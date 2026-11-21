import { describe, expect, it } from 'vitest';
import { DeleteSheetOperation } from '@core/editor-operations/services/descriptors/DeleteSheetOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): DeleteSheetOperation {
  const { store, parser, sheetRefs, reflow, actions } = fixture;
  return new DeleteSheetOperation(store, parser, sheetRefs, reflow, actions.delete);
}

describe('delete_sheet', () => {
  it('removes a sheet and gives its scenes back to main', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ sheet: 'sheet:other' });

    expect(result.ok).toBe(true);
    expect(fixture.store.sheet('other')).toBeNull();
    expect(fixture.sheetOfWord('w5')).toBe('main');
  });

  it('refuses to remove the main sheet', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ sheet: 'sheet:main' });

    expect(result.ok).toBe(false);
    expect(fixture.store.sheet('main')).not.toBeNull();
  });
});
