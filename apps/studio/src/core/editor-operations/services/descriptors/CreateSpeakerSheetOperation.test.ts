import { describe, expect, it } from 'vitest';
import { CreateSpeakerSheetOperation } from '@core/editor-operations/services/descriptors/CreateSpeakerSheetOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): CreateSpeakerSheetOperation {
  const { store, parser, reflow, sheetCreationOptions, actions } = fixture;
  return new CreateSpeakerSheetOperation(store, parser, reflow, sheetCreationOptions, actions.createSpeaker, actions.rename, actions.setActive);
}

describe('create_speaker_sheet', () => {
  it('moves the second voice onto a sheet of its own, named as asked, linked to main', async () => {
    const fixture = new SheetOperationsFixture();
    fixture.attributeSpeakers({ w1: 'A', w2: 'A', w3: 'B', w4: 'B', w5: 'A' });

    const result = await operationOn(fixture).run({ speaker: 'B', name: 'Ana' });

    expect(result.ok).toBe(true);
    const sheetId = (result.output as { sheet: string }).sheet.slice('sheet:'.length);
    expect(fixture.store.sheet(sheetId)?.name).toBe('Ana');
    expect(fixture.sheetOfWord('w3')).toBe(sheetId);
    expect(fixture.sheetOfWord('w1')).toBe('main');
    expect(fixture.store.sheet(sheetId)?.linkGroupId).toBe(fixture.store.sheet('main')?.linkGroupId);
    expect(fixture.store.snapshot().activeSheetId).toBe('main');
  });

  it('refuses the first voice, which keeps the main sheet, and names the voices that can', async () => {
    const fixture = new SheetOperationsFixture();
    fixture.attributeSpeakers({ w1: 'A', w2: 'A', w3: 'B', w4: 'B', w5: 'A' });

    const result = await operationOn(fixture).run({ speaker: 'A' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('Voices that can: B');
  });
});
