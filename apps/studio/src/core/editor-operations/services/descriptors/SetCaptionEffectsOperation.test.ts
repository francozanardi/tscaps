import { describe, expect, it } from 'vitest';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { SetCaptionEffectsOperation } from '@core/editor-operations/services/descriptors/SetCaptionEffectsOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';
import { UpdateEffectsAction } from '@core/sheets/actions/style/UpdateEffectsAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

function operationOn(fixture: SheetOperationsFixture): SetCaptionEffectsOperation {
  const { store, parser, sheetRefs, actions, project } = fixture;
  return new SetCaptionEffectsOperation(
    store,
    parser,
    sheetRefs,
    new ActiveSheetEditRunner(store, actions.setActive),
    new UpdateEffectsAction(store, project.inertRefresh(), new LinkedSheetsSync(new LinkedSheetsPropagationNotifier())),
  );
}

describe('set_caption_effects', () => {
  it('turns on the sheet named\'s automatic emojis and lowercase, leaving the sheet on screen', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ sheet: 'sheet:other', automaticEmojis: true, emojiPlacement: 'word', lowercase: true });

    expect(result.output).toEqual({ sheet: 'sheet:other', changed: ['emoji', 'smart_lowercase'] });
    const other = fixture.store.sheet('other')!;
    expect(other.effectConfig('emoji')).toMatchObject({ enabled: true, placement: 'word' });
    expect(other.effectConfig('smart_lowercase')?.enabled).toBe(true);
    expect(fixture.store.sheet('main')!.effectConfig('emoji')?.enabled).toBe(false);
    expect(fixture.store.snapshot().activeSheetId).toBe('main');
  });

  it('warns when transcription suggested no emoji to show', async () => {
    const fixture = new SheetOperationsFixture();
    const document = fixture.store.snapshot().document!;
    fixture.store.patch({
      document: document.with({
        sections: document.sections.map((section) => section.with({
          segments: section.segments.map((segment) => segment.with({
            lines: segment.lines.map((line) => line.with({ words: line.words.map((word) => word.with({ decoration: null })) })),
          })),
        })),
      }),
    });

    const result = await operationOn(fixture).run({ automaticEmojis: true });

    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('suggested no emoji') })]);
  });
});
