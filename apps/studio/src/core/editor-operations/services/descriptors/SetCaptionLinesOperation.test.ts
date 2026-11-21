import { DocumentEditor } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import { JoinCaptionsOperation } from '@core/editor-operations/services/descriptors/JoinCaptionsOperation';
import { SetCaptionLinesOperation } from '@core/editor-operations/services/descriptors/SetCaptionLinesOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): SetCaptionLinesOperation {
  const { store, parser, actions } = fixture;
  return new SetCaptionLinesOperation(store, parser, new CaptionRefResolver(store, parser), new CaptionStructureEditor(new DocumentEditor()), actions.applyStructureEdit);
}

/** The fixture with its first two scenes joined into one of four words, "Hello world" over "Again here". */
async function joinedFixture(): Promise<SheetOperationsFixture> {
  const fixture = new SheetOperationsFixture();
  const { store, parser, actions } = fixture;
  const join = new JoinCaptionsOperation(store, parser, new CaptionRefResolver(store, parser), new CaptionStructureEditor(new DocumentEditor()), actions.applyStructureEdit);
  await join.run({ segment: 'segment:s1' });
  return fixture;
}

function linesOfFirstScene(fixture: SheetOperationsFixture): string[] {
  return fixture.store.snapshot().document!.getSegments()[0]!.lines.map((line) => line.words.map((word) => word.text).join(' '));
}

describe('set_caption_lines', () => {
  it('breaks the caption\'s lines at the words asked, keeping every word\'s time', async () => {
    const fixture = await joinedFixture();

    const result = await operationOn(fixture).run({ segment: 'segment:s1', lineStarts: ['word:w4', 'word:w2'] });

    expect(result.ok).toBe(true);
    expect(linesOfFirstScene(fixture)).toEqual(['Hello', 'world Again', 'here']);
    expect(fixture.store.snapshot().document!.getWords().find((word) => word.id === 'w2')?.time.start).toBe(0.5);
    expect((result.output as { lines: { text: string }[] }).lines.map((line) => line.text)).toEqual(['Hello', 'world Again', 'here']);
  });

  it('puts the whole caption on one line when no word starts a line', async () => {
    const fixture = await joinedFixture();

    const result = await operationOn(fixture).run({ segment: 'segment:s1', lineStarts: [] });

    expect(result.ok).toBe(true);
    expect(linesOfFirstScene(fixture)).toEqual(['Hello world Again here']);
  });

  it('refuses a word of another caption and the caption\'s first word, changing nothing', async () => {
    const fixture = await joinedFixture();

    const result = await operationOn(fixture).run({ segment: 'segment:s1', lineStarts: ['word:w1', 'word:w5'] });

    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.ref)).toEqual(['word:w1', 'word:w5']);
    expect(linesOfFirstScene(fixture)).toEqual(['Hello world', 'Again here']);
  });
});
