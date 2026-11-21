import { describe, expect, it } from 'vitest';
import { Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { AddAudioClipsAction } from '@core/audio-mix/actions/AddAudioClipsAction';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { RenderTimeMapBuilder } from '@core/cuts/services/RenderTimeMapBuilder';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { AddSoundsOperation } from '@core/editor-operations/services/descriptors/AddSoundsOperation';
import { CrowdedSoundFinder } from '@core/editor-operations/services/CrowdedSoundFinder';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * Sounds placed by a program: on a word of what is said, on a shot or a
 * layer, or at a time pinned to what is spoken or shown there, under the
 * speech by default, and none of them where one cannot be placed.
 */

/** A word every two seconds, w0 at 0 s to w11 at 22 s, each 1.5 s long. */
const EVERY_TWO_SECONDS = Array.from({ length: 12 }, (_, index) => index * 2);

function setUp(wordStarts: ReadonlyArray<number> = EVERY_TWO_SECONDS, shots: ShotPartition = ShotPartition.empty()) {
  const store = new EditorStore();
  const segments = wordStarts.map((startSec, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ id: `w${index}`, text: `w${index}.`, time: new TimeFragment(startSec, startSec + 1.5) })] })],
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
  const parser = new EditorRefParser();
  const media = new MediaAssetStore();
  media.put({
    id: 'clip', type: 'video', owner: { kind: 'library' }, fileName: 'clip', mimeType: '', sizeBytes: 1, widthPx: 100, heightPx: 100, durationSec: 5,
  });
  const timing = new AudioAnchorTiming(new ShotLayerTiming(new ShotLayerAssetReader()), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility()));
  const sounds = new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/');
  const operation = new AddSoundsOperation(
    store,
    parser,
    new ShotRefResolver(store, materializer, parser),
    materializer,
    new OriginalCaptionTrackReader(),
    timing,
    new RenderTimeMapBuilder(),
    media,
    sounds,
    new AddAudioClipsAction(store, new AudioClipDefaults(), materializer, new TestAudioMixTelemetry().reporter),
    new CrowdedSoundFinder(timing, sounds),
  );
  return { store, operation };
}

const TEMPLATE = { styleControls: [], variants: [], metadata: { id: 't' }, effectConfigs: [], modes: BODY_ONLY_MODES } as unknown as Template;

/** The sheet the captions route to, with automatic emojis on. */
function sheetShowingEmojis(): Sheet {
  return Sheet.fromTemplate('main', 'main', null, TEMPLATE, 'ltr').with({
    effectConfigs: [{ type: 'emoji', enabled: true, placement: EMOJI_PLACEMENT_DEFAULT, size: EMOJI_SIZE_DEFAULT, gap: EMOJI_GAP_DEFAULT }],
  });
}

function clipOf(store: EditorStore, soundRef: unknown) {
  return store.snapshot().audio.clip(String(soundRef).replace('sound:', ''));
}

describe('add_sounds', () => {
  it('puts a sound on a word of the original speech, under the speech, at the word\'s start', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({ sounds: [{ sound: 'pop-bloop', at: { word: 'word:w3' } }] });

    const added = (result.output as { added: Array<Record<string, unknown>> }).added;
    expect(added).toEqual([{ sound: expect.stringMatching(/^sound:/), soundId: 'pop-bloop', on: 'word:w3', atSec: 6, volume: 0.14 }]);
    expect(clipOf(store, added[0]!['sound'])).toMatchObject({
      role: 'effect',
      source: { kind: 'builtin', soundId: 'pop-bloop' },
      start: { anchor: { kind: 'word', wordId: 'w3', edge: 'start' }, offsetSec: 0 },
      volume: 0.14,
    });
  });

  it('pins a time to the edge of the word spoken there, so it plays at that time', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({ sounds: [{ sound: 'ding-chime', at: { sec: 6.3 }, volume: 0.5 }] });

    const added = (result.output as { added: Array<Record<string, unknown>> }).added;
    expect(added[0]).toMatchObject({ on: 'word:w3', atSec: 6.3 });
    expect(clipOf(store, added[0]!['sound'])?.start).toEqual({ anchor: { kind: 'word', wordId: 'w3', edge: 'start' }, offsetSec: 0.3 });
  });

  it('pins a time in a long pause to the nearest edge of a shot, and places sounds on a shot\'s end and a layer\'s entry', async () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 10, layers: [{ id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
      ],
    });
    const { store, operation } = setUp([0, 20], shots);

    const result = await operation.run({ sounds: [
      { sound: 'whoosh-soft', at: { sec: 8 } },
      { sound: 'swish', at: { shot: 'shot:a', edge: 'end' }, offsetSec: -0.2 },
      { sound: 'pop-mouth', at: { layer: 'layer:broll' } },
    ] });

    const added = (result.output as { added: Array<Record<string, unknown>> }).added;
    expect(added.map(({ on, atSec }) => ({ on, atSec }))).toEqual([
      { on: expect.stringMatching(/^shot:/), atSec: 8 },
      { on: 'shot:a', atSec: 9.8 },
      { on: 'layer:broll', atSec: 10 },
    ]);
    expect(clipOf(store, added[0]!['sound'])?.start.anchor.kind).toBe('shot');
    expect(clipOf(store, added[2]!['sound'])?.start.anchor).toEqual({ kind: 'layer', layerId: 'broll', edge: 'entry' });
  });

  it('puts a sound on a moment a graphic declares, and refuses a moment it does not', async () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [{ id: 'a', startSec: 0, layers: [{ id: 'card', graphic: {
        document: { html: '<p>4</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 2,
        moments: [{ id: 'land', label: 'The number lands', sec: 0.12 }], presetId: null, hidesCaptions: false,
      } }] }],
    });
    const { store, operation } = setUp(EVERY_TWO_SECONDS, shots);

    const placed = await operation.run({ sounds: [{ sound: 'impact-hit', at: { layer: 'layer:card', moment: 'land' } }] });
    const refused = await operation.run({ sounds: [{ sound: 'impact-hit', at: { layer: 'layer:card', moment: 'slam' } }] });

    const added = (placed.output as { added: Array<Record<string, unknown>> }).added;
    expect(clipOf(store, added[0]!['sound'])?.start).toEqual({ anchor: { kind: 'layer-moment', layerId: 'card', momentId: 'land' }, offsetSec: 0 });
    expect(refused.ok).toBe(false);
    expect(refused.problems.map((problem) => problem.message)).toEqual([expect.stringMatching(/declares no moment "slam"; it declares land/)]);
  });

  it('plays each sound at its own level under the voice, and warns about one set loud enough to compete with the speech', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({ sounds: [
      { sound: 'impact-hit', at: { word: 'word:w1' } },
      { sound: 'click-mouse', at: { word: 'word:w4' } },
      { sound: 'impact-hit', at: { word: 'word:w7' }, volume: 0.3 },
      { sound: 'click-mouse', at: { word: 'word:w10' }, volume: 0.5 },
    ] });

    const volumes = store.snapshot().audio.clips().map((clip) => clip.volume);
    expect(volumes).toEqual([0.091, 0.37, 0.3, 0.5]);
    const added = (result.output as { added: Array<Record<string, unknown>> }).added;
    expect(result.problems).toEqual([
      expect.objectContaining({ severity: 'warning', ref: added[2]!['sound'], message: expect.stringMatching(/about 10 dB over where it sits under the voice/) }),
    ]);
  });

  it('warns about a sound less than two seconds from another, once per pair, naming the other', async () => {
    const { operation } = setUp([0, 1, 6, 7, 12]);
    const first = await operation.run({ sounds: [{ sound: 'whoosh-soft', at: { word: 'word:w0' } }] });

    const result = await operation.run({ sounds: [
      { sound: 'pop-mouth', at: { word: 'word:w2' } },
      { sound: 'pop-mouth', at: { word: 'word:w3' } },
      { sound: 'pop-mouth', at: { word: 'word:w1' } },
    ] });

    const earlier = (first.output as { added: Array<Record<string, unknown>> }).added[0]!['sound'];
    const added = (result.output as { added: Array<Record<string, unknown>> }).added;
    expect(result.problems).toEqual([
      expect.objectContaining({ severity: 'warning', ref: added[1]!['sound'], message: expect.stringMatching(new RegExp(`plays 1 s after ${String(added[0]!['sound'])} \\(pop-mouth\\) at 6 s: sounds less than 2 s apart usually blur`)) }),
      expect.objectContaining({ severity: 'warning', ref: added[2]!['sound'], message: expect.stringMatching(new RegExp(`plays 1 s after ${String(earlier)} \\(whoosh-soft\\) at 0 s`)) }),
    ]);
  });

  it('lets sounds two seconds apart, and a riser with the hit it lands on, be', async () => {
    const { operation } = setUp([0, 2, 4, 5.6]);

    const result = await operation.run({ sounds: [
      { sound: 'pop-mouth', at: { word: 'word:w0' } },
      { sound: 'whoosh-soft', at: { word: 'word:w1' } },
      { sound: 'riser-short', at: { word: 'word:w2' } },
      { sound: 'impact-hit', at: { word: 'word:w3' } },
    ] });

    expect(result.problems).toEqual([]);
  });

  it('adds a sound on a word that is cut away, warning that it stays silent', async () => {
    const { store, operation } = setUp();
    store.patch({ cuts: CutRegistry.empty().add({ startSec: 5.8, endSec: 7.6 }) });

    const result = await operation.run({ sounds: [{ sound: 'pop-bloop', at: { word: 'word:w3' } }] });

    expect(result.ok).toBe(true);
    expect(store.snapshot().audio.clips()).toHaveLength(1);
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringMatching(/cut away/) })]);
  });

  it('puts a sound on an emoji, where its word starts, warning while the captions do not show the emoji', async () => {
    const { store, operation } = setUp();
    const [w0, w1] = store.snapshot().document!.getWords();
    // Both emojis suggested by transcription, in one caption: it shows the second only.
    const caption = new Segment({ id: 's0', lines: [new Line({ words: [
      w0!.with({ decoration: new Decoration({ id: 'w0:d', glyph: '👋' }) }),
      w1!.with({ decoration: new Decoration({ id: 'w1:d', glyph: '🔥' }) }),
    ] })] });
    store.patch({ document: new Document({ sections: [new Section({ kind: 'main', segments: [caption] })] }), sheets: [sheetShowingEmojis()] });

    const result = await operation.run({ sounds: [
      { sound: 'pop-mouth', at: { decoration: 'decoration:w0:d' } },
      { sound: 'pop-mouth', at: { decoration: 'decoration:w1:d' } },
    ] });

    const added = (result.output as { added: Array<Record<string, unknown>> }).added;
    expect(added.map(({ on, atSec }) => ({ on, atSec }))).toEqual([{ on: 'decoration:w0:d', atSec: null }, { on: 'decoration:w1:d', atSec: 2 }]);
    expect(clipOf(store, added[0]!['sound'])?.start).toEqual({ anchor: { kind: 'emoji', decorationId: 'w0:d' }, offsetSec: 0 });
    expect(result.problems).toEqual([
      expect.objectContaining({ severity: 'warning', ref: added[0]!['sound'], message: 'decoration:w0:d is not on screen: the sound stays silent until it shows.' }),
    ]);
  });

  it.each([
    ['a sound the pack does not have', { sound: 'airhorn', at: { word: 'word:w3' } }, /not a bundled sound\. Some: whoosh-soft/],
    ['a word that is gone', { sound: 'pop-bloop', at: { word: 'word:gone' } }, /not in the captions any more/],
    ['two places at once', { sound: 'pop-bloop', at: { word: 'word:w3', sec: 2 } }, /exactly one of word, decoration, shot, layer or sec/],
    ['a word as an emoji', { sound: 'pop-bloop', at: { decoration: 'word:w3' } }, /not an emoji ref/],
    ['an emoji that is gone', { sound: 'pop-bloop', at: { decoration: 'decoration:w3:gone' } }, /not in the captions any more/],
    ['an edge given with an emoji', { sound: 'pop-bloop', at: { decoration: 'decoration:w3:gone', edge: 'end' } }, /a sound on an emoji plays where its word starts/],
    ['a time past the video\'s end', { sound: 'pop-bloop', at: { sec: 30 } }, /past the video's end/],
    ['an edge given with a time', { sound: 'pop-bloop', at: { sec: 3, edge: 'end' } }, /edge is for a word/],
  ])('refuses every sound when one names %s, adding none', async (_, faulty, message) => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run({ sounds: [{ sound: 'pop-bloop', at: { word: 'word:w1' } }, faulty] });

    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.message)).toEqual([expect.stringMatching(message)]);
    expect(store.snapshot()).toBe(before);
  });
});
