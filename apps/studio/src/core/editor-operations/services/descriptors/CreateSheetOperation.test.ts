import { describe, expect, it } from 'vitest';
import { CreateSheetOperation } from '@core/editor-operations/services/descriptors/CreateSheetOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): CreateSheetOperation {
  const { store, parser, sceneRefs, reflow, actions } = fixture;
  return new CreateSheetOperation(store, parser, sceneRefs, reflow, actions.create, actions.setActive, actions.assignScenes);
}

describe('create_sheet', () => {
  it('adds a copy of the main sheet, moves the scenes onto it, and leaves the sheet on screen as it was', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ name: 'Quotes', segments: ['segment:s2'] });

    expect(result.ok).toBe(true);
    const sheetRef = (result.output as { sheet: string }).sheet;
    const sheetId = sheetRef.slice('sheet:'.length);
    expect(fixture.store.sheet(sheetId)?.name).toBe('Quotes');
    expect(fixture.sheetOfWord('w3')).toBe(sheetId);
    expect(fixture.sheetOfWord('w1')).toBe('main');
    expect(fixture.store.snapshot().activeSheetId).toBe('main');
  });

  it('changes nothing when a scene ref is not on screen', async () => {
    const fixture = new SheetOperationsFixture();
    const sheetsBefore = fixture.store.snapshot().sheets;

    const result = await operationOn(fixture).run({ name: 'Quotes', segments: ['segment:s2', 'segment:gone'] });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot().sheets).toBe(sheetsBefore);
  });
});
