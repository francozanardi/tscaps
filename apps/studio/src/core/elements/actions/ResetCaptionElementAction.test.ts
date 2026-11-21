import { describe, expect, it } from 'vitest';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ResetCaptionElementAction } from '@core/elements/actions/ResetCaptionElementAction';

/**
 * A caption element's reset takes it back to its template: its own
 * style, whether it goes behind the person, and the sounds placed on it;
 * another element's stay.
 */

const refresh = { execute: () => undefined } as unknown as RefreshDocumentAction;

function setUp() {
  const store = new EditorStore();
  const sound = (id: string, wordId: string) => new AudioClipDefaults().clipFrom(id, {
    role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: { anchor: { kind: 'word', wordId, edge: 'start' }, offsetSec: 0 },
  });
  const state = store.snapshot();
  store.patch({
    elementStyles: state.elementStyles.withCss('w1', 'word', 'color: red;').withCss('w2', 'word', 'color: blue;'),
    behindActorOverrides: state.behindActorOverrides.with('w1', 'force-on'),
    audio: state.audio.withClipAdded(sound('on-w1', 'w1')).withClipAdded(sound('on-w2', 'w2')),
  });
  return { store, action: new ResetCaptionElementAction(store, refresh) };
}

describe('ResetCaptionElementAction', () => {
  it('takes back the element\'s style, its place behind the person and its sounds, in one undo step', () => {
    const { store, action } = setUp();

    expect(action.holdsAnything('w1')).toBe(true);
    action.execute('w1');

    const after = store.snapshot();
    expect(after.elementStyles.has('w1')).toBe(false);
    expect(after.elementStyles.has('w2')).toBe(true);
    expect(after.behindActorOverrides.all().has('w1')).toBe(false);
    expect(after.audio.clips().map((clip) => clip.id)).toEqual(['on-w2']);
    expect(action.holdsAnything('w1')).toBe(false);
    store.undo();
    expect(store.snapshot().audio.clips().map((clip) => clip.id)).toEqual(['on-w1', 'on-w2']);
  });

  it('takes no step for an element holding nothing of its own', () => {
    const { store, action } = setUp();

    action.execute('nothing');

    expect(store.snapshot().canUndo).toBe(false);
  });
});
