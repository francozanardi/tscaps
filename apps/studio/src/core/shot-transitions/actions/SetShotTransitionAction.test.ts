import { describe, expect, it } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SetShotTransitionAction } from '@core/shot-transitions/actions/SetShotTransitionAction';
import { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/**
 * Setting how the picture passes into a shot, and whether the sound it
 * suggests plays on the cut: one undo step each, which makes a proposal
 * the user's own as any edit does, and which only ever adds or takes off
 * the transition's own sound.
 */

const SUGGESTIONS = new ShotTransitionSoundSuggestions();

function editorWithSpeech(): EditorStore {
  const store = new EditorStore();
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
  }));
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
    video: { ...store.snapshot().video, duration: 24 },
  });
  return store;
}

function setup() {
  const store = editorWithSpeech();
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const telemetry = new RecordingShotTelemetry();
  const action = new SetShotTransitionAction(store, materializer, SUGGESTIONS, new AudioClipDefaults(), telemetry.edits);
  const shotIds = materializer.materializeFrom(store.snapshot()).list().map((shot) => shot.id);
  return { store, action, telemetry, first: shotIds[0]!, second: shotIds[1]! };
}

describe('setting a transition into a shot', () => {
  it('makes the proposal the user\'s own, with the transition and its suggested sound on the transition', () => {
    const { store, action, second } = setup();

    action.execute(second, { kind: 'whip', durationSec: 0.6 }, true);

    const state = store.snapshot();
    expect(state.shots.isEmpty()).toBe(false);
    expect(state.shots.list().find((shot) => shot.id === second)?.transition).toEqual({ kind: 'whip', durationSec: 0.6 });
    const sound = SUGGESTIONS.clipIn(state.audio, second, 'whip');
    expect(sound?.start).toEqual({ anchor: { kind: 'transition', shotId: second }, offsetSec: -0.1 });
    expect(sound?.volume).toBe(0.056);
    expect(state.audio.clips()).toHaveLength(1);
  });

  it('brings the sound back for the next kind after one that suggests none, and keeps a sound taken off off', () => {
    const { store, action, second } = setup();
    const pick = (kind: 'whip' | 'fade-black' | 'blur') => {
      const held = store.snapshot().shots.list().find((shot) => shot.id === second)?.transition ?? null;
      action.execute(second, { kind, durationSec: 0.5 }, SUGGESTIONS.keepsSound(store.snapshot().audio, second, held));
    };

    pick('whip');
    pick('fade-black');
    expect(store.snapshot().audio.clips()).toEqual([]);
    pick('whip');
    expect(SUGGESTIONS.clipIn(store.snapshot().audio, second, 'whip')).not.toBeNull();

    store.patch({ audio: store.snapshot().audio.withoutClips(store.snapshot().audio.clips().map((clip) => clip.id)) });
    pick('blur');
    expect(store.snapshot().audio.clips()).toEqual([]);
  });

  it('adds no sound for a kind that suggests none', () => {
    const { store, action, second } = setup();

    action.execute(second, { kind: 'iris', durationSec: 0.5 }, true);

    expect(store.snapshot().audio.clips()).toEqual([]);
  });

  it('adds no sound when none is asked for', () => {
    const { store, action, second } = setup();

    action.execute(second, { kind: 'flash', durationSec: 0.5 }, false);

    expect(store.snapshot().audio.clips()).toEqual([]);
  });

  it('refuses the first shot, which has no cut before it', () => {
    const { store, action, first } = setup();
    const before = store.snapshot();

    action.execute(first, { kind: 'flash', durationSec: 0.5 }, true);

    expect(store.snapshot()).toBe(before);
  });

  it('swaps the sound for the new kind\'s, and is undone in one step', () => {
    const { store, action, second } = setup();
    action.execute(second, { kind: 'whip', durationSec: 0.5 }, true);

    action.execute(second, { kind: 'flash', durationSec: 0.5 }, true);

    const state = store.snapshot();
    expect(SUGGESTIONS.clipIn(state.audio, second, 'whip')).toBeNull();
    expect(SUGGESTIONS.clipIn(state.audio, second, 'flash')).not.toBeNull();
    store.undo();
    expect(SUGGESTIONS.clipIn(store.snapshot().audio, second, 'whip')).not.toBeNull();
    expect(store.snapshot().shots.list().find((shot) => shot.id === second)?.transition?.kind).toBe('whip');
  });

  it('keeps the sound through a change of length, and takes it off when asked to', () => {
    const { store, action, second } = setup();
    action.execute(second, { kind: 'blur', durationSec: 0.5 }, true);
    const sound = SUGGESTIONS.clipIn(store.snapshot().audio, second, 'blur');

    action.execute(second, { kind: 'blur', durationSec: 1 }, true);
    expect(SUGGESTIONS.clipIn(store.snapshot().audio, second, 'blur')).toBe(sound);

    action.execute(second, { kind: 'blur', durationSec: 1 }, false);
    expect(store.snapshot().audio.clips()).toEqual([]);
  });

  it('takes the transition and every sound on it off on a plain cut, leaving the shot\'s own sounds', () => {
    const { store, action, second } = setup();
    action.execute(second, { kind: 'shake', durationSec: 0.5 }, true);
    const effect = (id: string, anchor: AudioAnchor) => new AudioClipDefaults().clipFrom(id, {
      role: 'effect',
      source: { kind: 'builtin', soundId: 'pop-bloop' },
      start: { anchor, offsetSec: 0 },
    });
    store.patch({
      audio: store.snapshot().audio
        .withClipAdded(effect('on-shot', { kind: 'shot', shotId: second, edge: 'start' }))
        .withClipAdded(effect('on-transition', { kind: 'transition', shotId: second })),
    });

    action.execute(second, null, true);

    const state = store.snapshot();
    expect(state.shots.list().find((shot) => shot.id === second)?.transition).toBeUndefined();
    expect(state.audio.clips().map((clip) => clip.id)).toEqual(['on-shot']);
  });

  it('swaps only the suggested sound as the kind changes, keeping one added by hand', () => {
    const { store, action, second } = setup();
    action.execute(second, { kind: 'whip', durationSec: 0.4 }, true);
    store.patch({
      audio: store.snapshot().audio.withClipAdded(new AudioClipDefaults().clipFrom('mine', {
        role: 'effect',
        source: { kind: 'builtin', soundId: 'pop-bloop' },
        start: { anchor: { kind: 'transition', shotId: second }, offsetSec: 0 },
      })),
    });

    action.execute(second, { kind: 'blur', durationSec: 0.5 }, true);

    const ids = SUGGESTIONS.clipsOn(store.snapshot().audio, second).map((clip) => clip.source.kind === 'builtin' ? clip.source.soundId : '');
    expect(ids.sort()).toEqual(['pop-bloop', 'whoosh-soft']);
  });
});

describe('reporting a transition picked', () => {
  it('reports a kind picked with whether it came with its sound, and nothing for a new length', () => {
    const { action, telemetry, second } = setup();

    action.execute(second, { kind: 'whip', durationSec: 0.4 }, true);
    action.execute(second, { kind: 'whip', durationSec: 0.9 }, true);
    action.execute(second, { kind: 'glitch', durationSec: 0.4 }, false);
    action.execute(second, null, false);

    expect(telemetry.propertiesOf('shot_transition_set')).toEqual([
      { kind: 'whip', previous_kind: 'cut', with_sound: true },
      { kind: 'glitch', previous_kind: 'whip', with_sound: false },
      { kind: 'cut', previous_kind: 'glitch', with_sound: false },
    ]);
  });
});
