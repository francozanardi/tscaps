import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';
import { describe, expect, it } from 'vitest';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { AddAudioClipsAction } from '@core/audio-mix/actions/AddAudioClipsAction';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { AnchoredSoundsPresenter } from '@presentation/audio-mix/services/AnchoredSoundsPresenter';
import { AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';
import { SoundNames } from '@presentation/audio-mix/services/SoundNames';

/**
 * A sound is added where it plays — on a word, at a shot's edge, at a
 * layer's entry or exit — and found again there: each place lists only
 * its own sounds, several layers edited together read as one with
 * *Mixed* where they differ, and the transcript offers no sound on a
 * word of a translation.
 */

const POP: AudioSourceRef = { kind: 'builtin', soundId: 'pop' };
const WHOOSH: AudioSourceRef = { kind: 'builtin', soundId: 'whoosh' };
const NO_FILES = MediaAssetCatalog.of([]);

const presenter = new AnchoredSoundsPresenter(new SoundNames(new StaticFileBuiltinSoundCatalog(
  [
    { id: 'pop', name: 'Bubble pop', category: 'pop', lengthSec: 0.1, description: '', underVoiceVolume: 0.15 },
    { id: 'whoosh', name: 'Soft whoosh', category: 'whoosh', lengthSec: 0.7, description: '', underVoiceVolume: 0.15 },
  ],
  '/app/',
)), new AudioOffsetNudge());

function editor() {
  const store = new EditorStore();
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const addClips = new AddAudioClipsAction(store, new AudioClipDefaults(), materializer, new TestAudioMixTelemetry().reporter);
  const add = (anchor: AudioAnchor, source: AudioSourceRef = POP) => addClips.execute([presenter.effectDraft(anchor, source)]);
  return { store, addClips, add };
}

describe('sounds where their anchors are', () => {
  it('puts a sound picked on a word at that word\'s start, right on it', () => {
    const { store, add } = editor();

    add(presenter.wordAnchor('w-amazing'));

    expect(store.snapshot().audio.clips()[0]).toMatchObject({
      role: 'effect',
      source: POP,
      start: { anchor: { kind: 'word', wordId: 'w-amazing', edge: 'start' }, offsetSec: 0 },
      end: null,
    });
  });

  it('lists at a shot\'s start only the sounds there, not those at its end or on another shot', () => {
    const { store, add } = editor();
    add(presenter.shotAnchor('a', 'start'), POP);
    add(presenter.shotAnchor('a', 'end'), WHOOSH);
    add(presenter.shotAnchor('b', 'start'), WHOOSH);

    const sounds = presenter.soundsOn(store.snapshot().audio, presenter.shotAnchor('a', 'start'), NO_FILES);

    expect(sounds.map((sound) => sound.name)).toEqual(['Bubble pop']);
    expect(presenter.soundCountOn(store.snapshot().audio, presenter.shotAnchor('a', 'end'))).toBe(1);
  });

  it('lists on a word every sound it carries, the one at its end saying so', () => {
    const { store, add } = editor();
    add(presenter.wordAnchor('w-amazing'), POP);
    add({ kind: 'word', wordId: 'w-amazing', edge: 'end' }, WHOOSH);

    const sounds = presenter.soundsOn(store.snapshot().audio, presenter.wordAnchor('w-amazing'), NO_FILES);

    expect(sounds.map((sound) => [sound.name, sound.placeNote])).toEqual([['Bubble pop', null], [sounds[1]!.name, 'At the end of the word']]);
    expect(presenter.soundCountOn(store.snapshot().audio, presenter.wordAnchor('w-amazing'))).toBe(2);
  });

  it('marks the words carrying sounds, once for a word a shot boundary cuts through', () => {
    const { store, add } = editor();
    add(presenter.wordAnchor('w-cut'));
    const marked = presenter.wordsWithSounds(store.snapshot().audio);

    expect(marked).toEqual(new Set(['w-cut']));
    expect(presenter.marksSound({ wordId: 'w-cut', text: 'amaz…', startSec: 4.8, endSec: 5.3 }, 0, marked)).toBe(true);
    expect(presenter.marksSound({ wordId: 'w-cut', text: '…ing', startSec: 4.8, endSec: 5.3 }, 5, marked)).toBe(false);
    expect(presenter.marksSound({ wordId: 'w-other', text: 'hello', startSec: 6, endSec: 6.4 }, 5, marked)).toBe(false);
  });

  it('offers a sound on a transcript word only while the Original track is shown', () => {
    expect(presenter.offersSoundsOnTranscriptWords(null)).toBe(true);
    expect(presenter.offersSoundsOnTranscriptWords('original')).toBe(true);
    expect(presenter.offersSoundsOnTranscriptWords('es')).toBe(false);
  });

  it('nudges a sound in small steps, never more than a second from what it is on', () => {
    const at = (offsetSec: number) => ({ anchor: presenter.wordAnchor('w'), offsetSec });
    expect(presenter.nudged(at(0), 1)).toBe(0.05);
    expect(presenter.nudged(at(-0.05), -1)).toBe(-0.1);
    expect(presenter.nudged(at(0.98), 1)).toBe(1);
    expect(presenter.nudged(at(-1), -1)).toBe(-1);
  });

  it('says how far a sound plays from what it is on, and where it cannot move further', () => {
    const { store, addClips } = editor();
    addClips.execute([{ ...presenter.effectDraft(presenter.wordAnchor('w'), POP), start: { anchor: presenter.wordAnchor('w'), offsetSec: -1 } }]);

    const [sound] = presenter.soundsOn(store.snapshot().audio, presenter.wordAnchor('w'), NO_FILES);

    expect(sound).toMatchObject({ nudgeLabel: '−1.00s', canNudgeEarlier: false, canNudgeLater: true });
  });
});

describe('a sound on several layers edited together', () => {
  const LAYERS = ['broll-a', 'broll-b'];
  const anchorsOf = (edge: 'entry' | 'exit') => LAYERS.map((layerId) => presenter.layerAnchor(layerId, edge));

  it('reads as none until some layer plays one', () => {
    const { store } = editor();

    expect(presenter.sharedSound(store.snapshot().audio, anchorsOf('entry'), NO_FILES)).toMatchObject({ name: null, clipIds: [] });
  });

  it('is given to every layer at once, at the edge picked, in one undo step', () => {
    const { store, addClips } = editor();

    const change = presenter.sharedSoundChange(store.snapshot().audio, anchorsOf('exit'), POP);
    addClips.execute(change.drafts, change.replacedClipIds);

    const view = presenter.sharedSound(store.snapshot().audio, anchorsOf('exit'), NO_FILES);
    expect(view).toMatchObject({ name: 'Bubble pop', isNameMixed: false, isVolumeMixed: false });
    expect(view.clipIds).toHaveLength(2);
    expect(presenter.sharedSound(store.snapshot().audio, anchorsOf('entry'), NO_FILES).name).toBeNull();
    store.undo();
    expect(store.snapshot().audio.hasClips()).toBe(false);
  });

  it('is mixed where only some layers play one, or they play different ones', () => {
    const { store, add } = editor();
    add(presenter.layerAnchor('broll-b', 'entry'), WHOOSH);

    expect(presenter.sharedSound(store.snapshot().audio, anchorsOf('entry'), NO_FILES)).toMatchObject({ name: 'Soft whoosh', isNameMixed: true });

    add(presenter.layerAnchor('broll-a', 'entry'), POP);
    expect(presenter.sharedSound(store.snapshot().audio, anchorsOf('entry'), NO_FILES)).toMatchObject({ name: 'Bubble pop', isNameMixed: true });
  });

  it('replaces each layer\'s sound with the one picked, keeping the level each had', () => {
    const { store, addClips } = editor();
    addClips.execute([
      { ...presenter.effectDraft(presenter.layerAnchor('broll-a', 'entry'), POP), volume: 0.4 },
      { ...presenter.effectDraft(presenter.layerAnchor('broll-b', 'entry'), POP), volume: 1.5 },
    ]);
    expect(presenter.sharedSound(store.snapshot().audio, anchorsOf('entry'), NO_FILES)).toMatchObject({ volumePercent: 40, isVolumeMixed: true });

    const change = presenter.sharedSoundChange(store.snapshot().audio, anchorsOf('entry'), WHOOSH);
    addClips.execute(change.drafts, change.replacedClipIds);

    const clips = store.snapshot().audio.clips();
    expect(clips).toHaveLength(2);
    expect(clips.map((clip) => [clip.source, clip.volume])).toEqual([[WHOOSH, 0.4], [WHOOSH, 1.5]]);
  });

  it('reads the offset across the layers, and keeps each one\'s when the sound is replaced', () => {
    const { store, addClips } = editor();
    const at = (layerId: string, offsetSec: number) => ({ anchor: presenter.layerAnchor(layerId, 'exit'), offsetSec });
    addClips.execute([
      { ...presenter.effectDraft(presenter.layerAnchor('broll-a', 'exit'), POP), start: at('broll-a', -0.2) },
      { ...presenter.effectDraft(presenter.layerAnchor('broll-b', 'exit'), POP), start: at('broll-b', 0) },
    ]);
    expect(presenter.sharedSound(store.snapshot().audio, anchorsOf('exit'), NO_FILES)).toMatchObject({ offsetSec: -0.2, isOffsetMixed: true });

    const change = presenter.sharedSoundChange(store.snapshot().audio, anchorsOf('exit'), WHOOSH);
    addClips.execute(change.drafts, change.replacedClipIds);

    expect(store.snapshot().audio.clips().map((clip) => clip.start.offsetSec)).toEqual([-0.2, 0]);
  });
});
