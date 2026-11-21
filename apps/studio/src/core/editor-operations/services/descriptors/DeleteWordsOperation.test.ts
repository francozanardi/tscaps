import { describe, expect, it } from 'vitest';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { DeleteWordsOperation } from '@core/editor-operations/services/descriptors/DeleteWordsOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): DeleteWordsOperation {
  return new DeleteWordsOperation(new CaptionRefResolver(fixture.store, fixture.parser), fixture.actions.deleteWords);
}

function wordsOf(fixture: SheetOperationsFixture): string[] {
  return fixture.store.snapshot().document!.getWords().map((word) => word.id);
}

describe('delete_words', () => {
  it('takes the words out of the captions', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ words: ['word:w2', 'word:w3'] });

    expect(result.output).toEqual({ deleted: [{ word: 'word:w2', text: 'world' }, { word: 'word:w3', text: 'Again' }] });
    expect(wordsOf(fixture)).toEqual(['w1', 'w4', 'w5']);
  });

  it('deletes nothing when one ref is not a word on screen', async () => {
    const fixture = new SheetOperationsFixture();

    expect((await operationOn(fixture).run({ words: ['word:w2', 'word:gone'] })).ok).toBe(false);
    expect(wordsOf(fixture)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5']);
  });
});
