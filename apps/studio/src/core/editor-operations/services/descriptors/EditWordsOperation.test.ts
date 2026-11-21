import { describe, expect, it } from 'vitest';
import { EditWordTagsAction } from '@core/captions/actions/words/EditWordTagsAction';
import { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import { CaptionsTextEditTelemetryReporter } from '@core/captions/services/CaptionsTextEditTelemetryReporter';
import { WordTagEditTelemetryReporter } from '@core/captions/services/WordTagEditTelemetryReporter';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { EditWordsOperation } from '@core/editor-operations/services/descriptors/EditWordsOperation';
import { WordTagLookChecker } from '@core/editor-operations/services/WordTagLookChecker';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';

const project = new CaptionOperationsTestProject();
const telemetry: Telemetry = { capture: () => {} };

function captionedProject(): EditorStore {
  return project.store([project.sheet('main', project.template({ id: 'plain' }))]);
}

function operationOn(store: EditorStore): EditWordsOperation {
  const parser = new EditorRefParser();
  const deriver = project.deriverFor(store);
  return new EditWordsOperation(
    new CaptionRefResolver(store, parser),
    store,
    parser,
    new EditWordTextAction(store, deriver, new CaptionsTextEditTelemetryReporter(telemetry, store)),
    new EditWordTagsAction(store, deriver, new WordTagEditTelemetryReporter(telemetry, store), project.inertRefresh()),
    new WordTagLookChecker(store),
  );
}

function wordTexts(store: EditorStore): string[] {
  return store.snapshot().document!.getWords().map((word) => word.text);
}

function tagsOf(store: EditorStore, wordId: string): string[] {
  const word = store.snapshot().document!.getWords().find((each) => each.id === wordId)!;
  return [...word.semanticTags].map((tag) => tag.name).sort();
}

describe('edit_words', () => {
  it('changes the text and the tags of every word named, answering their refs', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ edits: [{ word: 'word:w1', text: 'Hi' }, { word: 'word:w4', tags: ['entity'] }] });

    expect(result.output).toEqual({ changed: ['word:w1', 'word:w4'] });
    expect(wordTexts(store)).toEqual(['Hi', 'world', 'Again', 'here']);
    expect(tagsOf(store, 'w4')).toEqual(['entity']);
  });

  it('keeps the tags the analysis gave a whole phrase when it replaces the hand-set ones', async () => {
    const store = captionedProject();

    await operationOn(store).run({ edits: [{ word: 'word:w3', tags: ['quote'] }] });

    expect(tagsOf(store, 'w3')).toEqual(['peak', 'quote']);
  });

  it('answers the refs of the words a text with spaces became', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ edits: [{ word: 'word:w1', text: 'New York' }] });

    const york = store.snapshot().document!.getWords().find((word) => word.text === 'York')!;
    expect(result.output).toEqual({ changed: ['word:w1'], split: [{ word: 'word:w1', into: ['word:w1', `word:${york.id}`] }] });
    expect(result.problems.map((problem) => problem.severity)).toEqual(['warning']);
  });

  it('changes nothing when one of the words is gone', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ edits: [{ word: 'word:w1', text: 'Hi' }, { word: 'word:gone', text: 'Bye' }] });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('refuses a tag no hand sets, and empty text, changing nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();
    const operation = operationOn(store);

    const tagged = await operation.run({ edits: [{ word: 'word:w1', tags: ['peak'] }] });
    const emptied = await operation.run({ edits: [{ word: 'word:w1', text: '  ' }] });

    expect([tagged.ok, emptied.ok]).toEqual([false, false]);
    expect(store.snapshot()).toBe(before);
  });

  it('writes nothing for text a word already says', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ edits: [{ word: 'word:w1', text: 'Hello' }] });

    expect(result.output).toEqual({ changed: [] });
    expect(store.snapshot()).toBe(before);
  });

  it('warns that a tag the caption style never selects leaves the word looking like the rest', async () => {
    const store = captionedProject();
    const word = store.snapshot().document!.getWords()[0]!;

    const result = await operationOn(store).run({ edits: [{ word: `word:${word.id}`, tags: ['number'] }] });

    expect(result.ok).toBe(true);
    expect(result.problems.some((problem) => problem.severity === 'warning' && problem.message.includes('"number"'))).toBe(true);
  });
});
