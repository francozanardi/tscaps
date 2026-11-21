import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { Document, Line, RenderTimeMap, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioMixBuildContext } from '@core/audio-mix/domain/AudioMixBuildContext';
import type { AudioMixLayer } from '@core/audio-mix/domain/AudioMixLayer';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import { FootageSoundReader } from '@core/audio-mix/services/FootageSoundReader';
import { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

/**
 * What is heard: every clip resolved against the edit into when it plays
 * on the output, from where in its file, how loud and where it is
 * lowered — the one reading the preview and the export both play.
 */

const builder = new AudioMixLayerBuilder(
  new AudioAnchorTiming(new ShotLayerTiming(new ShotLayerAssetReader()), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility())),
  new SpeechSpanReader(),
  new FootageSoundReader(new ShotLayerTiming(new ShotLayerAssetReader())),
);

const SPEECH = new Document({
  sections: [new Section({
    kind: 'main',
    segments: [new Segment({
      lines: [new Line({ words: [
        new Word({ id: 'hello', text: 'hello', time: new TimeFragment(1, 1.5) }),
        new Word({ id: 'there', text: 'there', time: new TimeFragment(2, 2.5) }),
        new Word({ id: 'later', text: 'later', time: new TimeFragment(8, 9) }),
      ] })],
    })],
  })],
});

const FILE_LENGTHS: Readonly<Record<string, number>> = { whoosh: 0.75, song: 4 };

function contextOf(overrides: Partial<AudioMixBuildContext> = {}): AudioMixBuildContext {
  return {
    originalDocument: SPEECH,
    originalSheets: [],
    originalDecorationOverrides: DecorationOverrideRegistry.empty(),
    shots: ShotPartition.empty(),
    media: MediaAssetCatalog.empty(),
    timeMap: new RenderTimeMap([]),
    videoDurationSec: 10,
    sourceLengths: { lengthOf: (source: AudioSourceRef) => (source.kind === 'media' ? FILE_LENGTHS[source.mediaId] ?? null : null) },
    ...overrides,
  };
}

const AT_THERE: AudioAnchorPoint = { anchor: { kind: 'word', wordId: 'there', edge: 'start' }, offsetSec: 0 };
const VIDEO_START: AudioAnchorPoint = { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 };
const VIDEO_END: AudioAnchorPoint = { anchor: { kind: 'video', edge: 'end' }, offsetSec: 0 };

function clip(overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id: 'clip',
    role: 'effect',
    source: { kind: 'media', mediaId: 'whoosh' },
    start: AT_THERE,
    end: null,
    inSec: 0,
    loop: false,
    volume: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    ducking: { enabled: false, depthDb: -12 },
    ...overrides,
  };
}

function layersOf(clips: ReadonlyArray<AudioClip>, context: AudioMixBuildContext = contextOf()): ReadonlyArray<AudioMixLayer> {
  const mix = clips.reduce((built, added) => built.withClipAdded(added), AudioMix.empty());
  return builder.build(mix, context).layers;
}

function onlyLayer(added: AudioClip, context?: AudioMixBuildContext): AudioMixLayer {
  const layers = layersOf([added], context);
  expect(layers).toHaveLength(1);
  return layers[0]!;
}

describe('a clip with no end', () => {
  it('plays its file once from its in-point', () => {
    expect(onlyLayer(clip())).toMatchObject({
      outputStartSec: 2, outputEndSec: 2.75, sourceStartSec: 0, sourcePassSec: Infinity,
    });
  });

  it('plays what is left after its in-point', () => {
    expect(onlyLayer(clip({ inSec: 0.25 }))).toMatchObject({ outputEndSec: 2.5, sourceStartSec: 0.25 });
  });

  it('plays until the file ends where its length is not known yet', () => {
    expect(onlyLayer(clip({ source: { kind: 'builtin', soundId: 'pop' } })).outputEndSec).toBe(10);
  });

  it('loops until the output ends, starting over at its in-point', () => {
    expect(onlyLayer(clip({ role: 'music', source: { kind: 'media', mediaId: 'song' }, inSec: 1, loop: true }))).toMatchObject({
      outputStartSec: 2, outputEndSec: 10, sourceStartSec: 1, sourcePassSec: 3,
    });
  });
});

describe('a clip with an end', () => {
  const music = clip({ role: 'music', source: { kind: 'media', mediaId: 'song' }, start: VIDEO_START, end: VIDEO_END });

  it('is trimmed at its end', () => {
    expect(onlyLayer(clip({ end: { anchor: { kind: 'word', wordId: 'there', edge: 'end' }, offsetSec: 0 } })).outputEndSec)
      .toBe(2.5);
  });

  it('still stops where its file does when it does not loop', () => {
    expect(onlyLayer(music).outputEndSec).toBe(4);
  });

  it('loops to fill the span', () => {
    expect(onlyLayer({ ...music, loop: true })).toMatchObject({ outputStartSec: 0, outputEndSec: 10, sourcePassSec: 4 });
  });

  it('runs to the shortened output when cuts shorten the video', () => {
    expect(onlyLayer({ ...music, loop: true }, contextOf({ timeMap: new RenderTimeMap([{ startSec: 3, endSec: 5 }]) })).outputEndSec)
      .toBe(8);
  });

  it('plays as if it had none once its end anchor is gone', () => {
    const detachedEnd = { anchor: { kind: 'word', wordId: 'deleted', edge: 'start' }, offsetSec: 0 } as const;

    expect(onlyLayer(clip({ end: detachedEnd })).outputEndSec).toBe(2.75);
  });

  it('plays as if it had none where its end lands before its start', () => {
    const before = { anchor: { kind: 'word', wordId: 'hello', edge: 'start' }, offsetSec: 0 } as const;

    expect(onlyLayer(clip({ end: before })).outputEndSec).toBe(2.75);
  });

  it('ends where the cut collapses an end anchor that is cut away', () => {
    const toLater = { ...music, loop: true, end: { anchor: { kind: 'word', wordId: 'later', edge: 'start' }, offsetSec: 0 } } as const;

    expect(onlyLayer(toLater, contextOf({ timeMap: new RenderTimeMap([{ startSec: 7, endSec: 9 }]) })).outputEndSec).toBe(7);
  });
});

describe('a clip that is not heard', () => {
  it('is left out when its start anchor is gone', () => {
    expect(layersOf([clip({ start: { anchor: { kind: 'shot', shotId: 'joined', edge: 'start' }, offsetSec: 0 } })])).toEqual([]);
  });

  it('is left out when its start anchor is cut away', () => {
    expect(layersOf([clip()], contextOf({ timeMap: new RenderTimeMap([{ startSec: 2, endSec: 2.5 }]) }))).toEqual([]);
  });

  it('is left out when it would start after the output ends', () => {
    expect(layersOf([clip({ start: { ...VIDEO_END, offsetSec: 0.5 } })])).toEqual([]);
  });

  it('is left out when its in-point is past its file\'s end', () => {
    expect(layersOf([clip({ inSec: 1 })])).toEqual([]);
  });
});

describe('the level', () => {
  it('starts a clip nudged before zero at zero', () => {
    expect(onlyLayer(clip({ start: { ...VIDEO_START, offsetSec: -0.5 } })).outputStartSec).toBe(0);
  });

  it('carries the clip\'s volume and the video\'s own level', () => {
    const mix = AudioMix.empty().withClipAdded(clip({ volume: 0.5 })).withSourceVolume(0.25);

    expect(builder.build(mix, contextOf())).toMatchObject({ inputGain: 0.25, layers: [{ gain: 0.5 }] });
  });

  it('keeps fades that fit the clip', () => {
    expect(onlyLayer(clip({ source: { kind: 'media', mediaId: 'song' }, fadeInSec: 1, fadeOutSec: 2 })))
      .toMatchObject({ fadeInSec: 1, fadeOutSec: 2 });
  });

  it('shortens fades that together outrun the clip, in proportion', () => {
    expect(onlyLayer(clip({ fadeInSec: 0.5, fadeOutSec: 1 }))).toMatchObject({ fadeInSec: 0.25, fadeOutSec: 0.5 });
  });
});

describe('lowering under speech', () => {
  it('lowers a clip over the speech it overlaps, at its depth', () => {
    const music = clip({
      role: 'music', source: { kind: 'media', mediaId: 'song' }, start: VIDEO_START, end: VIDEO_END, loop: true, ducking: { enabled: true, depthDb: -20 },
    });

    expect(onlyLayer(music).duck).toEqual({
      ranges: [{ startSec: 1, endSec: 1.5 }, { startSec: 2, endSec: 2.5 }, { startSec: 8, endSec: 9 }],
      gain: 0.1,
      attackSec: AudioMixLayerBuilder.DUCK_ATTACK_SEC,
      releaseSec: AudioMixLayerBuilder.DUCK_RELEASE_SEC,
    });
  });

  it('leaves out the speech the clip does not reach', () => {
    const effect = clip({ source: { kind: 'media', mediaId: 'song' }, ducking: { enabled: true, depthDb: -12 } });

    expect(onlyLayer(effect).duck?.ranges).toEqual([{ startSec: 2, endSec: 2.5 }]);
  });

  it('does not lower a clip set not to be', () => {
    expect(onlyLayer(clip()).duck).toBeNull();
  });
});

describe('what the shots add', () => {
  const SHOTS = ShotPartition.fromSnapshot({
    maxShotSec: 4,
    shots: [
      { id: 'opening', startSec: 0 },
      { id: 'middle', startSec: 3, layers: [
        { id: 'broll', mediaId: 'clip', inSec: 0.5, outSec: null, loop: false },
        { id: 'logo', mediaId: 'logo', inSec: 0, outSec: null, loop: false },
      ] },
      { id: 'closing', startSec: 6 },
    ],
  });
  const MEDIA = MediaAssetCatalog.of([
    {
      id: 'clip', type: 'video', owner: { kind: 'project', projectId: 'project' }, fileName: 'clip.mp4',
      mimeType: 'video/mp4', sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: 2,
    },
    {
      id: 'logo', type: 'image', owner: { kind: 'project', projectId: 'project' }, fileName: 'logo.png',
      mimeType: 'image/png', sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: null,
    },
  ]);
  const shotsContext = contextOf({ shots: SHOTS, media: MEDIA });

  it('plays a heard b-roll\'s own sound while it shows, from the part of its file it shows, at its level', () => {
    const mix = AudioMix.empty().withFootageSound(['broll'], 0.6);

    expect(builder.build(mix, shotsContext).layers).toEqual([{
      id: 'footage:broll',
      kind: 'footage',
      source: { kind: 'media', mediaId: 'clip' },
      outputStartSec: 3,
      outputEndSec: 4.5,
      sourceStartSec: 0.5,
      sourcePassSec: 1.5,
      gain: 0.6,
      fadeInSec: FootageSoundReader.EDGE_FADE_SEC,
      fadeOutSec: FootageSoundReader.EDGE_FADE_SEC,
      duck: null,
    }]);
  });

  it('follows the b-roll across a cut that shortens its shot', () => {
    const cut = contextOf({ shots: SHOTS, media: MEDIA, timeMap: new RenderTimeMap([{ startSec: 1, endSec: 2 }]) });

    expect(builder.build(AudioMix.empty().withFootageSound(['broll'], 1), cut).layers[0]).toMatchObject({ outputStartSec: 2, outputEndSec: 3.5 });
  });

  it('hears nothing of a layer with no sound to give, or of a layer it was not asked to', () => {
    expect(builder.build(AudioMix.empty().withFootageSound(['logo'], 1), shotsContext).layers).toEqual([]);
    expect(builder.build(AudioMix.empty(), shotsContext).layers).toEqual([]);
  });

  it('brings the video\'s own sound to each shot\'s level over that shot, as it shows on the output, one duck per level', () => {
    const cut = contextOf({ shots: SHOTS, media: MEDIA, timeMap: new RenderTimeMap([{ startSec: 1, endSec: 2 }]) });
    const mix = AudioMix.empty().withShotVideoVolume(['middle'], 0).withShotVideoVolume(['opening', 'closing'], 1.5);
    const ramp = AudioMixLayerBuilder.SHOT_LEVEL_RAMP_SEC;

    expect(builder.build(mix, cut).inputDucks).toEqual([
      { ranges: [{ startSec: 0, endSec: 2 }, { startSec: 5, endSec: 9 }], gain: 1.5, attackSec: ramp, releaseSec: ramp },
      { ranges: [{ startSec: 2, endSec: 5 }], gain: 0, attackSec: ramp, releaseSec: ramp },
    ]);
  });

  it('changes nothing where no shot has a level of its own, or the one that has is only a proposal', () => {
    expect(builder.build(AudioMix.empty(), shotsContext).inputDucks).toEqual([]);
    expect(builder.build(AudioMix.empty().withShotVideoVolume(['t0.000'], 0), contextOf()).inputDucks).toEqual([]);
  });
});
