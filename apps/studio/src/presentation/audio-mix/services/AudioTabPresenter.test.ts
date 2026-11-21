import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { Decoration, Document, Line, RenderTimeMap, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ResolvedShot } from '@core/shots/domain/ResolvedShot';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { AudioAnchorLabels } from '@presentation/audio-mix/services/AudioAnchorLabels';
import { AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';
import { SoundNames } from '@presentation/audio-mix/services/SoundNames';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * The Audio tab is where every sound is found again: each effect says
 * what it is on in words the reader recognises, the list plays in the
 * order the video does, and an effect that makes no sound says why
 * rather than sitting there silently.
 */

const layerAssets = new ShotLayerAssetReader();
const builtinSounds = new StaticFileBuiltinSoundCatalog(
  [
    { id: 'pop', name: 'Bubble pop', category: 'pop', lengthSec: 0.1, description: '', underVoiceVolume: 0.15 },
    { id: 'whoosh', name: 'Soft whoosh', category: 'whoosh', lengthSec: 0.7, description: '', underVoiceVolume: 0.15 },
  ],
  '/app/',
);
const presenter = new AudioTabPresenter(
  new AudioAnchorTiming(new ShotLayerTiming(layerAssets), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility())),
  new AudioAnchorLabels(layerAssets, new ShotLayerLabels()),
  new SoundNames(builtinSounds),
  new AudioOffsetNudge(),
);

function documentOf(words: ReadonlyArray<readonly [string, string, number, number]>): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: [new Segment({
        lines: [new Line({ words: words.map(([id, text, start, end]) => new Word({ id, text, time: new TimeFragment(start, end) })) })],
      })],
    })],
  });
}

function asset(id: string, type: MediaAsset['type'], fileName: string): MediaAsset {
  return {
    id, type, owner: { kind: 'project', projectId: 'p' }, fileName, mimeType: '', sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: 4,
  };
}

const SPEECH = documentOf([['w-hello', 'hello', 1, 1.5], ['w-amazing', 'amazing', 12.4, 12.9]]);

const SHOTS = ShotPartition.fromSnapshot({
  maxShotSec: 10,
  shots: [
    { id: 'first', startSec: 0 },
    { id: 'second', startSec: 5 },
    {
      id: 'third',
      startSec: 10,
      layers: [
        { id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false },
        { id: 'picture', mediaId: 'still', inSec: 0, outSec: null, loop: false },
        { id: 'unlisted', mediaId: 'nowhere', inSec: 0, outSec: null, loop: false },
      ],
    },
  ],
});

const MEDIA = MediaAssetCatalog.of([
  asset('clip', 'video', 'clip.mp4'),
  asset('still', 'image', 'still.png'),
  asset('boing', 'audio', 'boing.wav'),
]);

function contextOf(overrides: Partial<AudioTimingContext> = {}): AudioTimingContext {
  return {
    originalDocument: SPEECH,
    originalSheets: [],
    originalDecorationOverrides: DecorationOverrideRegistry.empty(),
    shots: SHOTS,
    media: MEDIA,
    timeMap: new RenderTimeMap([]),
    videoDurationSec: 20,
    ...overrides,
  };
}

const TEMPLATE = { styleControls: [], variants: [], metadata: { id: 't' }, effectConfigs: [], modes: BODY_ONLY_MODES } as unknown as Template;

/**
 * The speech in one caption, both its words carrying an emoji
 * transcription suggested (👋 on "hello", 😮 on "amazing"), with
 * automatic emojis on: the caption shows the last only.
 */
function emojiContext(overrides: DecorationOverrideRegistry): AudioTimingContext {
  const glyphs: Readonly<Record<string, string>> = { hello: '👋', amazing: '😮' };
  const words = SPEECH.getWords().map((word) => word.with({ decoration: new Decoration({ id: `d-${word.text}`, glyph: glyphs[word.text]! }) }));
  const sheet = Sheet.fromTemplate('main', 'main', null, TEMPLATE, 'ltr').with({
    effectConfigs: [{ type: 'emoji', enabled: true, placement: EMOJI_PLACEMENT_DEFAULT, size: EMOJI_SIZE_DEFAULT, gap: EMOJI_GAP_DEFAULT }],
  });
  return contextOf({
    originalDocument: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ lines: [new Line({ words })] })] })] }),
    originalSheets: [sheet],
    originalDecorationOverrides: overrides,
  });
}

let nextId = 0;
function effect(start: AudioAnchorPoint['anchor'], source: AudioSourceRef = { kind: 'builtin', soundId: 'pop' }, offsetSec = 0): AudioClip {
  nextId += 1;
  return {
    id: `clip-${nextId}`, role: 'effect', source, start: { anchor: start, offsetSec }, end: null,
    inSec: 0, loop: false, volume: 1, fadeInSec: 0, fadeOutSec: 0, ducking: { enabled: false, depthDb: -12 },
  };
}

function mixOf(...clips: AudioClip[]): AudioMix {
  return clips.reduce((mix, clip) => mix.withClipAdded(clip), AudioMix.empty());
}

function rowsOf(mix: AudioMix, context: AudioTimingContext = contextOf()) {
  return presenter.effectRows(mix, context);
}

describe('what an effect is on', () => {
  it('names a word by its text and where it plays', () => {
    const [row] = rowsOf(mixOf(effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' })));

    expect(row!.anchor).toBe('“amazing” · 0:12.4');
  });

  it('names the end of a word, with its offset counted in the time', () => {
    const [row] = rowsOf(mixOf(effect({ kind: 'word', wordId: 'w-amazing', edge: 'end' }, undefined, 0.3)));

    expect(row!.anchor).toBe('End of “amazing” · 0:13.2');
  });

  it('reads the time on the output, once cuts before it are taken away', () => {
    const [row] = rowsOf(
      mixOf(effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' })),
      contextOf({ timeMap: new RenderTimeMap([{ startSec: 2, endSec: 4 }]) }),
    );

    expect(row!.anchor).toBe('“amazing” · 0:10.4');
  });

  it('names a camera by its shot, and says when it is gone', () => {
    const withCamera = contextOf({ shots: SHOTS.withLayerStyles(ElementStyles.empty().withAnimation(ShotVideoLayerId.of('second'), 'layer', ElementAnimationScope.CAMERA, { presetId: 'layer-zoom-in-camera', params: {} }, '')) });
    const [row] = rowsOf(mixOf(effect({ kind: 'camera', shotId: 'second' })), withCamera);
    const [gone] = rowsOf(mixOf(effect({ kind: 'camera', shotId: 'second' })));

    expect(row!.anchor).toBe('Camera of shot 2');
    expect(gone!.anchor).toBe('Its camera is gone');
  });

  it('names a layer\'s camera by what the layer shows and its shot, lands on the layer\'s start, and says when it is gone', () => {
    const withCamera = contextOf({ shots: SHOTS.withLayerStyles(ElementStyles.empty().withAnimation('broll', 'layer', ElementAnimationScope.CAMERA, { presetId: 'layer-zoom-in-camera', params: {} }, '')) });
    const [row] = rowsOf(mixOf(effect({ kind: 'layer-camera', layerId: 'broll' })), withCamera);
    const [gone] = rowsOf(mixOf(effect({ kind: 'layer-camera', layerId: 'broll' })));

    expect(row!.anchor).toBe('Camera of b-roll · Shot 3');
    expect(row!.seekSourceSec).toBeCloseTo(10, 3);
    expect(gone!.anchor).toBe('Its camera is gone');
  });

  it('names a transition by the shot it leads into, and says when it is gone', () => {
    const withTransition = contextOf({ shots: SHOTS.withTransition('second', { kind: 'whip', durationSec: 0.4 }) });
    const [row] = rowsOf(mixOf(effect({ kind: 'transition', shotId: 'second' })), withTransition);
    const [gone] = rowsOf(mixOf(effect({ kind: 'transition', shotId: 'second' })));

    expect(row!.anchor).toBe('Transition into shot 2');
    expect(gone!.anchor).toBe('Its transition is gone');
  });

  it('names a shot by its number', () => {
    const rows = rowsOf(mixOf(
      effect({ kind: 'shot', shotId: 'second', edge: 'start' }),
      effect({ kind: 'shot', shotId: 'third', edge: 'end' }),
    ));

    expect(rows.map((row) => row.anchor)).toEqual(['Shot 2 starts', 'Shot 3 ends']);
  });

  it('names a layer by what it shows and its shot', () => {
    const rows = rowsOf(mixOf(
      effect({ kind: 'layer', layerId: 'broll', edge: 'entry' }),
      effect({ kind: 'layer', layerId: 'picture', edge: 'exit' }),
      effect({ kind: 'layer', layerId: 'unlisted', edge: 'entry' }),
    ));

    expect(rows.map((row) => row.anchor)).toEqual(
      expect.arrayContaining(['B-roll enters · Shot 3', 'Picture exits · Shot 3', 'Layer enters · Shot 3']),
    );
  });

  it('names the video by its edge', () => {
    const rows = rowsOf(mixOf(
      effect({ kind: 'video', edge: 'start' }),
      effect({ kind: 'video', edge: 'end' }),
    ));

    expect(rows.map((row) => row.anchor)).toEqual(['Video starts', 'Video ends']);
  });
});

describe('the order of effects', () => {
  it('follows where each plays, not the order they were added', () => {
    const rows = rowsOf(mixOf(
      effect({ kind: 'video', edge: 'end' }),
      effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' }),
      effect({ kind: 'shot', shotId: 'second', edge: 'start' }),
      effect({ kind: 'word', wordId: 'w-hello', edge: 'start' }),
    ));

    expect(rows.map((row) => row.anchor)).toEqual(['“hello” · 0:01.0', 'Shot 2 starts', '“amazing” · 0:12.4', 'Video ends']);
  });

  it('keeps the order they were added where two start together', () => {
    const first = effect({ kind: 'shot', shotId: 'second', edge: 'start' }, { kind: 'builtin', soundId: 'whoosh' });
    const second = effect({ kind: 'shot', shotId: 'first', edge: 'end' }, { kind: 'builtin', soundId: 'pop' });

    expect(rowsOf(mixOf(first, second)).map((row) => row.clip.id)).toEqual([first.id, second.id]);
  });

  it('puts an effect whose start is gone last', () => {
    const gone = effect({ kind: 'word', wordId: 'deleted', edge: 'start' });
    const heard = effect({ kind: 'video', edge: 'end' });

    expect(rowsOf(mixOf(gone, heard)).map((row) => row.clip.id)).toEqual([heard.id, gone.id]);
  });

  it('lists no music among the effects', () => {
    const music = AudioMix.empty().withClipAdded({ ...effect({ kind: 'video', edge: 'start' }), role: 'music' });

    expect(rowsOf(music)).toEqual([]);
    expect(presenter.musicOf(music)).not.toBeNull();
  });
});

describe('an effect that makes no sound', () => {
  it('is in a cut while what it is on is cut away, and reads no time', () => {
    const [row] = rowsOf(
      mixOf(effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' })),
      contextOf({ timeMap: new RenderTimeMap([{ startSec: 12, endSec: 13 }]) }),
    );

    expect(row).toMatchObject({ state: 'in-cut', badge: 'In a cut', anchor: '“amazing”' });
  });

  it('is hidden while the captions do not show its emoji, named by the emoji and its word without a time', () => {
    const rows = rowsOf(
      mixOf(effect({ kind: 'emoji', decorationId: 'd-hello' }), effect({ kind: 'emoji', decorationId: 'd-amazing' })),
      emojiContext(DecorationOverrideRegistry.empty()),
    );

    expect(rows.map((row) => [row.state, row.badge, row.anchor])).toEqual([
      ['hidden', 'Emoji hidden', '👋 on “hello”'],
      ['heard', null, '😮 on “amazing” · 0:12.4'],
    ]);
  });

  it('is heard once the person changes its emoji, which makes it theirs, named by the emoji they chose', () => {
    const [row] = rowsOf(mixOf(effect({ kind: 'emoji', decorationId: 'd-hello' })), emojiContext(DecorationOverrideRegistry.empty().with('d-hello', { glyph: '✨' })));

    expect(row).toMatchObject({ state: 'heard', badge: null, anchor: '✨ on “hello” · 0:01.0' });
  });

  it('is detached once what it is on is gone, with nowhere to seek to', () => {
    const rows = rowsOf(mixOf(
      effect({ kind: 'word', wordId: 'deleted', edge: 'start' }),
      effect({ kind: 'shot', shotId: 'joined', edge: 'start' }),
      effect({ kind: 'layer', layerId: 'removed', edge: 'exit' }),
    ));

    expect(rows.map((row) => [row.state, row.badge, row.anchor, row.seekSourceSec])).toEqual([
      ['detached', 'Detached', 'Its word is gone', null],
      ['detached', 'Detached', 'Its shot is gone', null],
      ['detached', 'Detached', 'Its layer is gone', null],
    ]);
  });

  it('is heard with no badge otherwise, seeking to where it plays in the source', () => {
    const [row] = rowsOf(
      mixOf(effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' })),
      contextOf({ timeMap: new RenderTimeMap([{ startSec: 2, endSec: 4 }]) }),
    );

    expect(row).toMatchObject({ state: 'heard', badge: null, seekSourceSec: 12.4 });
  });
});

describe('the name of a sound', () => {
  it('is a bundled sound\'s name or the user\'s file name, and says when the file is gone', () => {
    const rows = rowsOf(mixOf(
      effect({ kind: 'video', edge: 'start' }, { kind: 'builtin', soundId: 'whoosh' }),
      effect({ kind: 'video', edge: 'start' }, { kind: 'media', mediaId: 'boing' }),
      effect({ kind: 'video', edge: 'start' }, { kind: 'media', mediaId: 'deleted' }),
      effect({ kind: 'video', edge: 'start' }, { kind: 'builtin', soundId: 'withdrawn' }),
    ));

    expect(rows.map((row) => row.name)).toEqual(['Soft whoosh', 'boing.wav', 'Missing file', 'Unknown sound']);
  });
});

describe('the music\'s in-point', () => {
  it('lands on a tenth of a second, inside the file', () => {
    expect(presenter.inPointAt(0.5, 61)).toBe(30.5);
    expect(presenter.inPointAt(-1, 61)).toBe(0);
    expect(presenter.inPointAt(1, 61)).toBe(60.9);
  });

  it('moves by tenths, never past either end', () => {
    expect(presenter.inPointNudged(10, 3, 61)).toBe(10.3);
    expect(presenter.inPointNudged(0, -5, 61)).toBe(0);
  });
});

describe('moving an effect to the playhead', () => {
  it('places it right at the playhead, against the nearest edge of a word', () => {
    expect(presenter.pointAtPlayhead(contextOf(), 1.2)).toEqual({ anchor: { kind: 'word', wordId: 'w-hello', edge: 'start' }, offsetSec: 0.2 });
    expect(presenter.pointAtPlayhead(contextOf(), 1.4)).toEqual({ anchor: { kind: 'word', wordId: 'w-hello', edge: 'end' }, offsetSec: -0.1 });
    expect(presenter.pointAtPlayhead(contextOf(), 12)).toEqual({ anchor: { kind: 'word', wordId: 'w-amazing', edge: 'start' }, offsetSec: -0.4 });
  });

  it('places it against a shot\'s edge where there are no words, and the video\'s start where there is no shot either', () => {
    const point = presenter.pointAtPlayhead(contextOf({ originalDocument: null }), 3);
    expect(point.anchor.kind).toBe('shot');
    expect(presenter.pointAtPlayhead(contextOf({ originalDocument: null, shots: ShotPartition.empty() }), 3))
      .toEqual({ anchor: { kind: 'video', edge: 'start' }, offsetSec: 3 });
  });
});

describe('nudging an effect from the Audio tab', () => {
  it('says how far it plays from its anchor, and moves it in small steps', () => {
    const [row] = rowsOf(mixOf(effect({ kind: 'word', wordId: 'w-hello', edge: 'start' }, undefined, 0.1)));

    expect(row!.offsetLabel).toBe('+0.10s');
    expect(row!.canNudgeEarlier).toBe(true);
    expect(presenter.nudged(row!.clip.start, 1)).toBe(0.15);
  });
});

describe('the sounds of one shot', () => {
  // The third shot, with the word that starts in it and one that only runs into it.
  const THIRD: ResolvedShot = {
    id: 'third',
    startSec: 10,
    endSec: 20,
    pieces: [{ wordId: 'w-before', text: 'before', startSec: 9.8, endSec: 10.3 }, { wordId: 'w-amazing', text: 'amazing', startSec: 12.4, endSec: 12.9 }],
    layers: SHOTS.list()[2]!.layers,
    continuingLayers: [],
  };

  it('lists what is on the shot, its camera, the transition into it, its layers and the words that start in it, in play order', () => {
    const mix = mixOf(
      effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' }),
      effect({ kind: 'shot', shotId: 'third', edge: 'end' }),
      effect({ kind: 'camera', shotId: 'third' }),
      effect({ kind: 'transition', shotId: 'third' }),
      effect({ kind: 'layer', layerId: 'broll', edge: 'entry' }),
      effect({ kind: 'layer-transition', layerId: 'broll', edge: 'exit' }),
    );

    const kinds = presenter.shotEffectRows(mix, contextOf(), THIRD).map((row) => row.clip.start.anchor.kind);

    expect(kinds).toHaveLength(6);
    expect(new Set(kinds)).toEqual(new Set(['word', 'shot', 'camera', 'transition', 'layer', 'layer-transition']));
  });

  it('leaves out what belongs elsewhere: another shot, a word that started before it, the video', () => {
    const mix = mixOf(
      effect({ kind: 'shot', shotId: 'second', edge: 'start' }),
      effect({ kind: 'word', wordId: 'w-before', edge: 'start' }),
      effect({ kind: 'word', wordId: 'w-hello', edge: 'start' }),
      effect({ kind: 'video', edge: 'start' }),
    );

    expect(presenter.shotEffectRows(mix, contextOf(), THIRD)).toEqual([]);
  });

  it('puts them by when they play: its own start first, then its camera and its transition; its own end; the rest during it', () => {
    const mix = mixOf(
      effect({ kind: 'transition', shotId: 'third' }),
      effect({ kind: 'word', wordId: 'w-amazing', edge: 'start' }),
      effect({ kind: 'shot', shotId: 'third', edge: 'end' }),
      effect({ kind: 'camera', shotId: 'third' }),
      effect({ kind: 'shot', shotId: 'third', edge: 'start' }),
      effect({ kind: 'layer', layerId: 'broll', edge: 'entry' }),
    );
    const placed = (rows: readonly { row: { clip: AudioClip }; own: boolean }[]) =>
      rows.map(({ row, own }) => [row.clip.start.anchor.kind, own]);

    const sections = presenter.shotSoundSections(mix, contextOf(), THIRD);

    expect(placed(sections.start)[0]).toEqual(['shot', true]);
    expect(new Set(placed(sections.start).slice(1).map(([kind]) => kind))).toEqual(new Set(['camera', 'transition']));
    expect(placed(sections.end)).toEqual([['shot', true]]);
    expect(placed(sections.during).sort()).toEqual([['layer', false], ['word', false]]);
  });
});

describe('the sounds of one layer', () => {
  it('puts them by the edge they play at: its own first, then its layout transition\'s and, as it enters, its camera\'s', () => {
    const mix = mixOf(
      effect({ kind: 'layer-camera', layerId: 'broll' }),
      effect({ kind: 'layer-transition', layerId: 'broll', edge: 'entrance' }),
      effect({ kind: 'layer', layerId: 'broll', edge: 'entry' }),
      effect({ kind: 'layer-transition', layerId: 'broll', edge: 'exit' }),
      effect({ kind: 'layer', layerId: 'broll', edge: 'exit' }),
      effect({ kind: 'shot', shotId: 'third', edge: 'start' }),
    );
    const placed = (rows: readonly { row: { clip: AudioClip }; own: boolean }[]) =>
      rows.map(({ row, own }) => [row.clip.start.anchor.kind, own]);

    const sections = presenter.layerSoundSections(mix, contextOf(), 'broll');

    expect(placed(sections.entrance)[0]).toEqual(['layer', true]);
    expect(new Set(placed(sections.entrance).slice(1).map(([kind]) => kind))).toEqual(new Set(['layer-transition', 'layer-camera']));
    expect(placed(sections.exit)).toEqual([['layer', true], ['layer-transition', false]]);
  });
});

describe('a graphic\'s sound page', () => {
  const graphicContext = contextOf({
    shots: ShotPartition.fromSnapshot({
      maxShotSec: 10,
      shots: [{
        id: 'only',
        startSec: 0,
        layers: [{
          id: 'card',
          graphic: {
            document: { html: '', css: '', js: '' },
            fields: [],
            params: {},
            aspectRatio: 3,
            moments: [{ id: 'press', label: 'Button pressed', sec: 1.3 }, { id: 'like', label: 'Liked', sec: 2 }], presetId: null, hidesCaptions: false,
          },
        }],
      }],
    }),
  });

  it('lists each moment the code declares under its name, in the order they happen, with the sounds on it', () => {
    const mix = mixOf(effect({ kind: 'layer-moment', layerId: 'card', momentId: 'like' }));

    const { moments } = presenter.layerSoundSections(mix, graphicContext, 'card');

    expect(moments.map(({ label, declared, rows }) => [label, declared, rows.length])).toEqual([
      ['Button pressed', true, 0],
      ['Liked', true, 1],
    ]);
  });

  it('keeps a moment the code no longer declares while a sound is on it, with no way to add more', () => {
    const mix = mixOf(effect({ kind: 'layer-moment', layerId: 'card', momentId: 'wave' }));

    const { moments } = presenter.layerSoundSections(mix, graphicContext, 'card');

    expect(moments.at(-1)).toMatchObject({ momentId: 'wave', label: 'wave', declared: false });
    expect(rowsOf(mix, graphicContext)[0]).toMatchObject({ anchor: 'Its moment “wave” is gone', state: 'detached' });
  });

  it('names a sound on a moment by the moment, then the layer', () => {
    const mix = mixOf(effect({ kind: 'layer-moment', layerId: 'card', momentId: 'press' }));

    expect(rowsOf(mix, graphicContext)[0]).toMatchObject({ anchor: 'Button pressed · Graphic · Shot 1', state: 'heard' });
  });
});
