import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';
import { describe, expect, it } from 'vitest';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { AddAudioClipsAction } from '@core/audio-mix/actions/AddAudioClipsAction';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/**
 * Several sounds added at once are one change: a sound given to every
 * layer picked is taken back by one undo, with the sounds it replaced.
 * A sound put on a shot the user has not edited yet makes the proposed
 * shots real in the same step, so the shot it names stays.
 */

const POP = { kind: 'builtin', soundId: 'pop' } as const;
const WHOOSH = { kind: 'builtin', soundId: 'whoosh' } as const;

function effectOn(anchor: AudioAnchor, source: AudioClipDraft['source'] = POP, volume?: number): AudioClipDraft {
  return { role: 'effect', source, start: { anchor, offsetSec: 0 }, ...(volume === undefined ? {} : { volume }) };
}

function editor(shots: ShotPartition = ShotPartition.empty()) {
  const store = new EditorStore();
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ id: `w${index}`, text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
  }));
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
    video: { ...store.snapshot().video, duration: 24 },
    shots,
  });
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const telemetry = new TestAudioMixTelemetry();
  return { store, materializer, telemetry, addClips: new AddAudioClipsAction(store, new AudioClipDefaults(), materializer, telemetry.reporter) };
}

const LAYERED = ShotPartition.fromSnapshot({
  maxShotSec: 6,
  shots: [
    { id: 'a', startSec: 0, layers: [{ id: 'broll-a', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
    { id: 'b', startSec: 6, layers: [{ id: 'broll-b', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
  ],
});

describe('adding several sounds at once', () => {
  it('gives every layer its own sound at the edge named', () => {
    const { store, addClips } = editor(LAYERED);

    const ids = addClips.execute([
      effectOn({ kind: 'layer', layerId: 'broll-a', edge: 'entry' }),
      effectOn({ kind: 'layer', layerId: 'broll-b', edge: 'entry' }),
    ]);

    const audio = store.snapshot().audio;
    expect(ids).toHaveLength(2);
    expect(ids.map((id) => audio.clip(id)?.start.anchor)).toEqual([
      { kind: 'layer', layerId: 'broll-a', edge: 'entry' },
      { kind: 'layer', layerId: 'broll-b', edge: 'entry' },
    ]);
  });

  it('takes the sounds of every layer back in one undo step', () => {
    const { store, addClips } = editor(LAYERED);

    addClips.execute([
      effectOn({ kind: 'layer', layerId: 'broll-a', edge: 'exit' }),
      effectOn({ kind: 'layer', layerId: 'broll-b', edge: 'exit' }),
    ]);
    store.undo();

    expect(store.snapshot().audio.hasClips()).toBe(false);
    expect(store.snapshot().canUndo).toBe(false);
  });

  it('replaces sounds in the same step, and one undo brings them back', () => {
    const { store, addClips } = editor(LAYERED);
    const [old] = addClips.execute([effectOn({ kind: 'layer', layerId: 'broll-a', edge: 'entry' }, POP, 0.5)]);

    const [replacement] = addClips.execute([effectOn({ kind: 'layer', layerId: 'broll-a', edge: 'entry' }, WHOOSH, 0.5)], [old!]);

    expect(store.snapshot().audio.clip(old!)).toBeNull();
    expect(store.snapshot().audio.clip(replacement!)).toMatchObject({ source: WHOOSH, volume: 0.5 });
    store.undo();
    expect(store.snapshot().audio.clips().map((clip) => clip.id)).toEqual([old]);
  });

  it('makes the proposed shots real, keeping the id the sound names, in the same undo step', () => {
    const { store, materializer, addClips } = editor();
    const proposed = materializer.materializeFrom(store.snapshot()).list()[1]!;

    const [id] = addClips.execute([effectOn({ kind: 'shot', shotId: proposed.id, edge: 'start' })]);

    expect(store.snapshot().shots.list().map((shot) => shot.id)).toContain(proposed.id);
    expect(store.snapshot().audio.clip(id!)?.start.anchor).toEqual({ kind: 'shot', shotId: proposed.id, edge: 'start' });
    store.undo();
    expect(store.snapshot().shots.isEmpty()).toBe(true);
    expect(store.snapshot().audio.hasClips()).toBe(false);
  });

  it('leaves the proposal alone for a sound on a word', () => {
    const { store, addClips } = editor();

    addClips.execute([effectOn({ kind: 'word', wordId: 'w3', edge: 'start' })]);

    expect(store.snapshot().shots.isEmpty()).toBe(true);
  });

  it('takes no step where nothing can be added', () => {
    const { store, addClips } = editor();

    expect(addClips.execute([effectOn({ kind: 'word', wordId: 'w3', edge: 'start' }, { kind: 'media', mediaId: '' })])).toEqual([]);
    expect(store.snapshot().canUndo).toBe(false);
  });

  it('reports each sound added by hand, a bundled one by its id and category, a file of the user\'s by nothing', () => {
    const { addClips, telemetry } = editor(LAYERED);
    const [old] = addClips.execute([effectOn({ kind: 'word', wordId: 'w1', edge: 'start' }, { kind: 'builtin', soundId: 'pop-bloop' })]);

    addClips.execute([effectOn({ kind: 'layer', layerId: 'broll-a', edge: 'entry' }, { kind: 'media', mediaId: 'my-sound' })], [old!]);

    expect(telemetry.propertiesOf('sound_effect_added')).toEqual([
      { anchor: 'word', source: 'builtin', sound_id: 'pop-bloop', category: 'pop', replaced: false },
      { anchor: 'layer', source: 'file', sound_id: null, category: null, replaced: true },
    ]);
  });
});
