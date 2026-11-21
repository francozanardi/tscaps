import { describe, expect, it } from 'vitest';
import { EditSheetOperation } from '@core/editor-operations/services/descriptors/EditSheetOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): EditSheetOperation {
  const { store, parser, sheetRefs, actions } = fixture;
  return new EditSheetOperation(store, parser, sheetRefs, actions.rename, actions.link, actions.unlink);
}

describe('edit_sheet', () => {
  it('renames a sheet and links it to another, then unlinks it', async () => {
    const fixture = new SheetOperationsFixture();

    const linked = await operationOn(fixture).run({ sheet: 'sheet:other', name: 'Guest', linkedTo: 'sheet:main' });
    expect(linked.output).toEqual({ sheet: 'sheet:other', name: 'Guest', linkedWith: ['sheet:main'] });

    const unlinked = await operationOn(fixture).run({ sheet: 'sheet:other', linkedTo: null });
    expect(unlinked.output).toMatchObject({ linkedWith: [] });
    expect(fixture.store.sheet('main')?.linkGroupId).toBeNull();
  });

  it('refuses a request that changes nothing, and a link to itself', async () => {
    const fixture = new SheetOperationsFixture();

    expect((await operationOn(fixture).run({ sheet: 'sheet:other' })).ok).toBe(false);
    expect((await operationOn(fixture).run({ sheet: 'sheet:other', linkedTo: 'sheet:other' })).ok).toBe(false);
  });
});
