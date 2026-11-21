import { describe, expect, it } from 'vitest';
import { Decoration, GraphemeWordSplitter, type Word } from '@tscaps/engine';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { ShownDecorationReader } from '@core/editor-operations/services/ShownDecorationReader';
import { AddDecorationAction } from '@core/captions/actions/decorations/AddDecorationAction';
import { ClearDecorationAction } from '@core/captions/actions/decorations/ClearDecorationAction';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SetEmojiOperation } from '@core/editor-operations/services/descriptors/SetEmojiOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';

const project = new CaptionOperationsTestProject();

function captionedProject({ automaticEmojis = false } = {}): EditorStore {
  const effects = automaticEmojis
    ? [{ type: 'emoji' as const, enabled: true, placement: EMOJI_PLACEMENT_DEFAULT, size: EMOJI_SIZE_DEFAULT, gap: EMOJI_GAP_DEFAULT }]
    : [];
  return project.store([project.sheet('main', project.template({ id: 'plain', effects }))]);
}

function operationOn(store: EditorStore): SetEmojiOperation {
  const parser = new EditorRefParser();
  const deriver = project.deriverFor(store);
  return new SetEmojiOperation(
    new CaptionRefResolver(store, parser),
    store,
    parser,
    new GraphemeWordSplitter(),
    new AddDecorationAction(store, deriver),
    new ClearDecorationAction(store, deriver),
    new ShownDecorationReader(new DecorationFilter(new DecorationVisibility())),
  );
}

function glyphOn(store: EditorStore, wordId: string): string | null {
  return store.snapshot().document!.getWords().find((word) => word.id === wordId)?.decoration?.glyph ?? null;
}

function shownOn(store: EditorStore): string[] {
  return [...new ShownDecorationReader(new DecorationFilter(new DecorationVisibility())).shownIds(store.snapshot())];
}

/** "Hello world" with automatic emojis on and a suggestion on each word: the caption shows 🔥 (on "world", the last), and leaves 👋 (on "Hello") out. */
function twoSuggestionsInOneCaption(): EditorStore {
  const store = captionedProject({ automaticEmojis: true });
  const document = store.snapshot().document!;
  const waving = (word: Word) => (word.id === 'w1' ? word.with({ decoration: new Decoration({ id: 'w1:d', glyph: '👋' }) }) : word);
  store.patch({ document: document.with({ sections: document.sections.map((section) => section.with({
    segments: section.segments.map((segment) => segment.with({ lines: segment.lines.map((line) => line.with({ words: line.words.map(waving) })) })),
  })) }) });
  return store;
}

describe('set_emoji', () => {
  it('shows the person\'s own in place of the emoji automatic emojis give its caption, and names that one', async () => {
    const store = captionedProject({ automaticEmojis: true });

    const result = await operationOn(store).run({ word: 'word:w1', emoji: '🎉' });

    expect(result.output).toEqual({ word: 'word:w1', emoji: '🎉', decoration: 'decoration:w1:d', insteadOf: { emoji: '🔥', word: 'word:w2' } });
    expect(shownOn(store)).toEqual(['w1:d']);
  });

  it('gives the caption its automatic emoji back once the person\'s own is taken away, and names it', async () => {
    const store = captionedProject({ automaticEmojis: true });
    const operation = operationOn(store);
    await operation.run({ word: 'word:w1', emoji: '🎉' });

    const result = await operation.run({ word: 'word:w1', emoji: null });

    expect(result.output).toEqual({ word: 'word:w1', emoji: null, removed: true, inItsPlace: { emoji: '🔥', word: 'word:w2' } });
    expect(shownOn(store)).toEqual(['w2:d']);
  });

  it('refuses to set the very suggestion the layout leaves out of a caption that shows another', async () => {
    const store = twoSuggestionsInOneCaption();
    const before = store.snapshot();

    const result = await operationOn(store).run({ word: 'word:w1', emoji: '👋' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toBe('word:w1 already holds 👋, a suggestion this layout leaves out: its caption\'s emoji is 🔥, one per caption, so it was not set.');
    expect(store.snapshot()).toBe(before);
  });

  it('sets that suggestion once the caption\'s own is taken away', async () => {
    const store = twoSuggestionsInOneCaption();

    await operationOn(store).run({ word: 'word:w2', emoji: null });
    const result = await operationOn(store).run({ word: 'word:w1', emoji: '👋' });

    expect(result.ok).toBe(true);
    expect(shownOn(store)).toEqual(['w1:d']);
  });

  it('sets another emoji on a word whose suggestion the layout leaves out', async () => {
    const store = twoSuggestionsInOneCaption();

    const result = await operationOn(store).run({ word: 'word:w1', emoji: '🎉' });

    expect(result.ok).toBe(true);
    expect(shownOn(store)).toEqual(['w1:d']);
  });

  it('brings back no other suggestion when it changes the emoji the caption shows', async () => {
    const store = twoSuggestionsInOneCaption();

    const result = await operationOn(store).run({ word: 'word:w2', emoji: '🧺' });

    expect(result.output).toEqual({ word: 'word:w2', emoji: '🧺', decoration: 'decoration:w2:d' });
    expect(shownOn(store)).toEqual(['w2:d']);
  });

  it('puts the emoji on the word and answers its ref', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ word: 'word:w1', emoji: '🎉' });

    expect(result.output).toEqual({ word: 'word:w1', emoji: '🎉', decoration: 'decoration:w1:d' });
    expect(glyphOn(store, 'w1')).toBe('🎉');
  });

  it('takes the word\'s emoji away with null', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ word: 'word:w1', emoji: '🎉' });

    const result = await operation.run({ word: 'word:w1', emoji: null });

    expect(result.ok).toBe(true);
    expect(glyphOn(store, 'w1')).toBeNull();
  });

  it('refuses text that is not an emoji, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ word: 'word:w1', emoji: 'ok' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('writes nothing when the word already shows that emoji as the person\'s own', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ word: 'word:w1', emoji: '🎉' });
    const before = store.snapshot();

    const result = await operation.run({ word: 'word:w1', emoji: '🎉' });

    expect(result.ok).toBe(true);
    expect(store.snapshot()).toBe(before);
  });
});
