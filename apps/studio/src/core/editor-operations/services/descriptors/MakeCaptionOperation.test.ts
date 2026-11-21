import { DocumentEditor } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import { MakeCaptionOperation } from '@core/editor-operations/services/descriptors/MakeCaptionOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): MakeCaptionOperation {
  const { store, parser, actions } = fixture;
  return new MakeCaptionOperation(store, parser, new CaptionRefResolver(store, parser), new CaptionStructureEditor(new DocumentEditor()), actions.applyStructureEdit);
}

function scenesText(fixture: SheetOperationsFixture): string[] {
  return fixture.store.snapshot().document!.getSegments().map((segment) => segment.getWords().map((word) => word.text).join(' '));
}

describe('make_caption', () => {
  it('makes a run of words across captions one caption, splitting the captions around it', async () => {
    const fixture = new SheetOperationsFixture();
    const startBefore = fixture.store.snapshot().document!.getWords().find((word) => word.id === 'w3')?.time.start;

    const result = await operationOn(fixture).run({ from: 'word:w2', to: 'word:w3' });

    expect(result.ok).toBe(true);
    expect(scenesText(fixture)).toEqual(['Hello', 'world Again', 'here', 'Bye']);
    expect(fixture.store.snapshot().document!.getWords().find((word) => word.id === 'w3')?.time.start).toBe(startBefore);
    expect((result.output as { lines: { text: string }[] }).lines.map((line) => line.text)).toEqual(['world', 'Again']);
  });

  it('leaves a caption that already holds exactly those words as it is', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ from: 'word:w1', to: 'word:w2' });

    expect(result.ok).toBe(true);
    expect(scenesText(fixture)).toEqual(['Hello world', 'Again here', 'Bye']);
  });

  it('refuses a last word that comes before the first, changing nothing', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ from: 'word:w3', to: 'word:w1' });

    expect(result.ok).toBe(false);
    expect(scenesText(fixture)).toEqual(['Hello world', 'Again here', 'Bye']);
  });
});
