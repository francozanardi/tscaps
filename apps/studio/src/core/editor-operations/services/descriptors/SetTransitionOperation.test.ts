import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { SetTransitionOperation } from '@core/editor-operations/services/descriptors/SetTransitionOperation';
import { SetShotTransitionAction } from '@core/shot-transitions/actions/SetShotTransitionAction';
import { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';

/**
 * A transition asked for by a program: the kind at its own length, its
 * suggested sound on the cut unless left out, and nothing at all for the
 * first shot, which no cut leads into.
 */

const suggestions = new ShotTransitionSoundSuggestions();

function setUp() {
  const store = new EditorStore();
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
  }));
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
    video: { ...store.snapshot().video, duration: 24 },
  });
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const parser = new EditorRefParser();
  const resolver = new ShotRefResolver(store, materializer, parser);
  const operation = new SetTransitionOperation(
    store,
    resolver,
    parser,
    suggestions,
    new SetShotTransitionAction(store, materializer, suggestions, new AudioClipDefaults(), new RecordingShotTelemetry().edits),
  );
  const [first, second] = resolver.shots();
  return { store, operation, first: first!, second: second! };
}

function transitionOf(store: EditorStore, shotId: string) {
  return store.snapshot().shots.list().find((shot) => shot.id === shotId)?.transition ?? null;
}

describe('set_transition', () => {
  it('sets the kind at its own length on the cut into a proposed shot, with its suggested sound', async () => {
    const { store, operation, second } = setUp();

    const result = await operation.run({ shot: second.ref, kind: 'whip' });

    expect(transitionOf(store, second.shot.id)).toEqual({ kind: 'whip', durationSec: 0.4 });
    const sound = suggestions.clipIn(store.snapshot().audio, second.shot.id, 'whip');
    expect(sound).not.toBeNull();
    expect(result.output).toEqual({ shot: second.ref, transition: { kind: 'whip', durationSec: 0.4 }, sounds: [`sound:${sound!.id}`] });
  });

  it('keeps the length of the kind the shot has, and takes the sound off when asked', async () => {
    const { store, operation, second } = setUp();
    await operation.run({ shot: second.ref, kind: 'blur', durationSec: 1.2 });

    await operation.run({ shot: second.ref, kind: 'blur', sound: false });

    expect(transitionOf(store, second.shot.id)).toEqual({ kind: 'blur', durationSec: 1.2 });
    expect(store.snapshot().audio.clips()).toEqual([]);
  });

  it('makes the cut plain again, with every sound on it', async () => {
    const { store, operation, second } = setUp();
    await operation.run({ shot: second.ref, kind: 'flash' });

    const result = await operation.run({ shot: second.ref, kind: null });

    expect(transitionOf(store, second.shot.id)).toBeNull();
    expect(store.snapshot().audio.clips()).toEqual([]);
    expect(result.output).toEqual({ shot: second.ref, transition: null, sounds: [] });
  });

  it.each([
    ['the first shot, which no cut leads into', (refs: { first: string; second: string }) => ({ shot: refs.first, kind: 'flash' }), /first shot/],
    ['a shot that is gone', () => ({ shot: 'shot:gone', kind: 'flash' }), /not a shot of this project/],
    ['a kind there is not', (refs: { first: string; second: string }) => ({ shot: refs.second, kind: 'dissolve' }), /kind/],
    ['a length out of range', (refs: { first: string; second: string }) => ({ shot: refs.second, kind: 'flash', durationSec: 3 }), /durationSec/],
  ])('refuses %s, changing nothing', async (_, inputFor, message) => {
    const { store, operation, first, second } = setUp();
    const before = store.snapshot();

    const result = await operation.run(inputFor({ first: first.ref, second: second.ref }));

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toMatch(message);
    expect(store.snapshot()).toBe(before);
  });
});
