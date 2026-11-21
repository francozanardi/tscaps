import { DocumentEditor } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import { SplitCaptionOperation } from '@core/editor-operations/services/descriptors/SplitCaptionOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): SplitCaptionOperation {
  const { store, parser, actions } = fixture;
  return new SplitCaptionOperation(store, parser, new CaptionRefResolver(store, parser), new CaptionStructureEditor(new DocumentEditor()), actions.applyStructureEdit);
}

function scenesText(fixture: SheetOperationsFixture): string[] {
  return fixture.store.snapshot().document!.getSegments().map((segment) => segment.getWords().map((word) => word.text).join(' '));
}

describe('split_caption', () => {
  it('starts a new caption at the word asked, keeping every word\'s time', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ before: 'word:w2' });

    expect(result.ok).toBe(true);
    expect(scenesText(fixture)).toEqual(['Hello', 'world', 'Again here', 'Bye']);
    expect(fixture.store.snapshot().document!.getWords().find((word) => word.id === 'w2')?.time.start).toBe(0.5);
    expect((result.output as { captions: string[] }).captions).toHaveLength(2);
  });

  it('refuses a word that already starts its caption', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ before: 'word:w1' });

    expect(result.ok).toBe(false);
    expect(scenesText(fixture)).toEqual(['Hello world', 'Again here', 'Bye']);
  });
});
