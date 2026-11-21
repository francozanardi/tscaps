import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { Decoration, Document, Line, RenderTimeMap, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * A sound follows what it is anchored to through every edit, and lands
 * on the output where that thing plays: a word through retimes and
 * cuts, a shot through boundary moves, a layer as the preview and the
 * export lay it out, an emoji while the captions show it. What is cut
 * away or not on screen makes no sound; what is gone is said to be gone
 * rather than guessed at.
 */

const timing = new AudioAnchorTiming(new ShotLayerTiming(new ShotLayerAssetReader()), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility()));

function documentOf(words: ReadonlyArray<readonly [string, number, number]>): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: [new Segment({
        lines: [new Line({ words: words.map(([id, start, end]) => new Word({ id, text: id, time: new TimeFragment(start, end) })) })],
      })],
    })],
  });
}

const SPEECH = documentOf([['hello', 1, 1.5], ['there', 2, 2.5], ['friend', 4, 4.6]]);

const SHOTS = ShotPartition.fromSnapshot({
  maxShotSec: 4,
  shots: [
    { id: 'first', startSec: 0 },
    { id: 'second', startSec: 3, layers: [{ id: 'picture', mediaId: 'unlisted', inSec: 0, outSec: null, loop: false }] },
    { id: 'third', startSec: 6 },
  ],
});

function contextOf(overrides: Partial<AudioTimingContext> = {}): AudioTimingContext {
  return {
    originalDocument: SPEECH,
    originalSheets: [],
    originalDecorationOverrides: DecorationOverrideRegistry.empty(),
    shots: SHOTS,
    media: MediaAssetCatalog.empty(),
    timeMap: new RenderTimeMap([]),
    videoDurationSec: 10,
    ...overrides,
  };
}

function at(anchor: AudioAnchor, context: AudioTimingContext = contextOf(), offsetSec = 0) {
  return timing.resolve({ anchor, offsetSec }, context);
}

describe('a word anchor', () => {
  it('lands where the word starts or ends', () => {
    expect(at({ kind: 'word', wordId: 'there', edge: 'start' })).toEqual({ kind: 'at', outputSec: 2 });
    expect(at({ kind: 'word', wordId: 'there', edge: 'end' })).toEqual({ kind: 'at', outputSec: 2.5 });
  });

  it('follows the word when it is retimed', () => {
    const retimed = contextOf({ originalDocument: documentOf([['hello', 1, 1.5], ['there', 2.8, 3.1]]) });

    expect(at({ kind: 'word', wordId: 'there', edge: 'start' }, retimed)).toEqual({ kind: 'at', outputSec: 2.8 });
  });

  it('moves earlier by what a cut before it takes away', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 1, endSec: 1.6 }]) });

    expect(at({ kind: 'word', wordId: 'there', edge: 'start' }, cut)).toEqual({ kind: 'at', outputSec: 1.4 });
  });

  it('is in a cut at either edge when the word is cut away, collapsed to where the cut starts', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 2, endSec: 2.5 }]) });

    expect(at({ kind: 'word', wordId: 'there', edge: 'start' }, cut)).toEqual({ kind: 'in-cut', outputSec: 2 });
    expect(at({ kind: 'word', wordId: 'there', edge: 'end' }, cut)).toEqual({ kind: 'in-cut', outputSec: 2 });
  });

  it('ends where a cut taking only the word\'s tail starts', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 2.2, endSec: 3 }]) });

    expect(at({ kind: 'word', wordId: 'there', edge: 'end' }, cut)).toEqual({ kind: 'at', outputSec: 2.2 });
  });

  it('is gone once the word is deleted', () => {
    expect(at({ kind: 'word', wordId: 'deleted', edge: 'start' })).toEqual({ kind: 'gone' });
  });

  it('is gone where no transcript is held', () => {
    expect(at({ kind: 'word', wordId: 'hello', edge: 'start' }, contextOf({ originalDocument: null }))).toEqual({ kind: 'gone' });
  });
});

describe('a shot anchor', () => {
  it('lands where the shot opens or ends', () => {
    expect(at({ kind: 'shot', shotId: 'second', edge: 'start' })).toEqual({ kind: 'at', outputSec: 3 });
    expect(at({ kind: 'shot', shotId: 'second', edge: 'end' })).toEqual({ kind: 'at', outputSec: 6 });
  });

  it('ends the last shot with the video', () => {
    expect(at({ kind: 'shot', shotId: 'third', edge: 'end' })).toEqual({ kind: 'at', outputSec: 10 });
  });

  it('follows a boundary that moves', () => {
    const moved = contextOf({ shots: SHOTS.moveStart('second', 3.5) });

    expect(at({ kind: 'shot', shotId: 'second', edge: 'start' }, moved)).toEqual({ kind: 'at', outputSec: 3.5 });
    expect(at({ kind: 'shot', shotId: 'first', edge: 'end' }, moved)).toEqual({ kind: 'at', outputSec: 3.5 });
  });

  it('runs through the cuts inside the shot', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 4, endSec: 5 }]) });

    expect(at({ kind: 'shot', shotId: 'second', edge: 'end' }, cut)).toEqual({ kind: 'at', outputSec: 5 });
  });

  it('is in a cut when the whole shot is cut away', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 2.5, endSec: 6.5 }]) });

    expect(at({ kind: 'shot', shotId: 'second', edge: 'start' }, cut)).toEqual({ kind: 'in-cut', outputSec: 2.5 });
  });

  it('is gone once the shot is joined away', () => {
    expect(at({ kind: 'shot', shotId: 'second', edge: 'start' }, contextOf({ shots: SHOTS.joinIntoPrevious('second') })))
      .toEqual({ kind: 'gone' });
  });

  it('is gone once the shots are proposed again', () => {
    expect(at({ kind: 'shot', shotId: 'first', edge: 'start' }, contextOf({ shots: SHOTS.reproposed(4) })))
      .toEqual({ kind: 'gone' });
  });
});

describe('a camera anchor', () => {
  const WITH_CAMERA = SHOTS.withLayerStyles(ElementStyles.empty().withAnimation(ShotVideoLayerId.of('second'), 'layer', ElementAnimationScope.CAMERA, { presetId: 'layer-zoom-in-camera', params: {} }, ''));

  it('lands on the start of the shot whose camera it is, through the cuts before it', () => {
    expect(at({ kind: 'camera', shotId: 'second' }, contextOf({ shots: WITH_CAMERA }))).toEqual({ kind: 'at', outputSec: 3 });
    expect(at({ kind: 'camera', shotId: 'second' }, contextOf({ shots: WITH_CAMERA, timeMap: new RenderTimeMap([{ startSec: 1, endSec: 2 }]) })))
      .toEqual({ kind: 'at', outputSec: 2 });
  });

  it('is gone once the shot has no camera, or the shot is joined away', () => {
    expect(at({ kind: 'camera', shotId: 'second' })).toEqual({ kind: 'gone' });
    expect(at({ kind: 'camera', shotId: 'second' }, contextOf({ shots: WITH_CAMERA.joinIntoPrevious('second') }))).toEqual({ kind: 'gone' });
  });
});

describe('a transition anchor', () => {
  const WITH_TRANSITION = SHOTS.withTransition('second', { kind: 'whip', durationSec: 0.4 });

  it('lands on the cut the transition plays over, through the cuts before it', () => {
    expect(at({ kind: 'transition', shotId: 'second' }, contextOf({ shots: WITH_TRANSITION }))).toEqual({ kind: 'at', outputSec: 3 });
    expect(at({ kind: 'transition', shotId: 'second' }, contextOf({ shots: WITH_TRANSITION, timeMap: new RenderTimeMap([{ startSec: 1, endSec: 2 }]) })))
      .toEqual({ kind: 'at', outputSec: 2 });
  });

  it('is gone once the transition is taken off, or its cut is joined away', () => {
    expect(at({ kind: 'transition', shotId: 'second' })).toEqual({ kind: 'gone' });
    expect(at({ kind: 'transition', shotId: 'second' }, contextOf({ shots: WITH_TRANSITION.joinIntoPrevious('second') }))).toEqual({ kind: 'gone' });
  });

  it('still sounds where the shot it opens is cut away whole, on the cut between the shots around it', () => {
    const secondCut = new RenderTimeMap([{ startSec: 3, endSec: 6 }]);
    expect(at({ kind: 'transition', shotId: 'second' }, contextOf({ shots: WITH_TRANSITION, timeMap: secondCut }))).toEqual({ kind: 'at', outputSec: 3 });
  });

  it('sounds with the transition that plays where two land on one cut, and is in a cut for the other', () => {
    const both = WITH_TRANSITION.withTransition('third', { kind: 'flash', durationSec: 0.4 });
    const secondCut = new RenderTimeMap([{ startSec: 3, endSec: 6 }]);
    expect(at({ kind: 'transition', shotId: 'second' }, contextOf({ shots: both, timeMap: secondCut }))).toEqual({ kind: 'at', outputSec: 3 });
    expect(at({ kind: 'transition', shotId: 'third' }, contextOf({ shots: both, timeMap: secondCut }))).toEqual({ kind: 'in-cut', outputSec: 3 });
    const thirdOnly = SHOTS.withTransition('third', { kind: 'flash', durationSec: 0.4 });
    expect(at({ kind: 'transition', shotId: 'third' }, contextOf({ shots: thirdOnly, timeMap: secondCut }))).toEqual({ kind: 'at', outputSec: 3 });
  });
});

describe('a layer transition anchor', () => {
  const layouts = new TestShotLayerLayouts().writer;
  const laidOut = (placement: ShotLayerPlacement, extra: Readonly<Record<string, ElementControlValue>> = {}) => {
    let styles = layouts.written(ElementStyles.empty(), 'picture', placement);
    for (const [fieldId, value] of Object.entries(extra)) {
      styles = styles.withField('picture', 'layer', fieldId as ElementFieldId, value, styles.get('picture')?.css ?? '');
    }
    return contextOf({ shots: SHOTS.withLayerStyles(styles) });
  };
  const split: ShotLayerPlacement = { kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover' };
  const inset: ShotLayerPlacement = {
    kind: 'inset', subject: 'video', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: null, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
  };

  it('lands in the middle of the split\'s line moving, which slides over half a second unless told', () => {
    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'entrance' }, laidOut(split))).toEqual({ kind: 'at', outputSec: 3.25 });
    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'exit' }, laidOut(split))).toEqual({ kind: 'at', outputSec: 5.75 });
  });

  it('follows the length the transition is given, at most half the layer', () => {
    const long = laidOut(inset, { [ElementFieldId.INSET_ENTRANCE]: '1', [ElementFieldId.INSET_ENTRANCE_DURATION]: 1 });
    const tooLong = laidOut(inset, { [ElementFieldId.INSET_ENTRANCE]: '1', [ElementFieldId.INSET_ENTRANCE_DURATION]: 2 });

    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'entrance' }, long)).toEqual({ kind: 'at', outputSec: 3.5 });
    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'entrance' }, tooLong)).toEqual({ kind: 'at', outputSec: 3.75 });
  });

  it('is gone where that end is a cut, or the layout has no transition', () => {
    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'entrance' }, laidOut(inset))).toEqual({ kind: 'gone' });
    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'entrance' }, laidOut({ kind: 'full', fit: 'cover' }))).toEqual({ kind: 'gone' });
    expect(at({ kind: 'layer-transition', layerId: 'picture', edge: 'entrance' }, laidOut(split, { [ElementFieldId.SPLIT_ENTRANCE]: '0' })))
      .toEqual({ kind: 'gone' });
  });
});

describe('a layer anchor', () => {
  it('lands where the layer enters and exits', () => {
    expect(at({ kind: 'layer', layerId: 'picture', edge: 'entry' })).toEqual({ kind: 'at', outputSec: 3 });
    expect(at({ kind: 'layer', layerId: 'picture', edge: 'exit' })).toEqual({ kind: 'at', outputSec: 6 });
  });

  it('exits where a b-roll shorter than its shot runs out', () => {
    const media = MediaAssetCatalog.of([{
      id: 'clip',
      type: 'video',
      owner: { kind: 'project', projectId: 'project' },
      fileName: 'clip.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1,
      widthPx: 1,
      heightPx: 1,
      durationSec: 1.5,
    }]);
    const shots = SHOTS.withLayerAdded('third', { id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false });

    expect(at({ kind: 'layer', layerId: 'broll', edge: 'exit' }, contextOf({ shots, media }))).toEqual({ kind: 'at', outputSec: 7.5 });
  });

  it('is in a cut when its shot is cut away whole', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 2.5, endSec: 6.5 }]) });

    expect(at({ kind: 'layer', layerId: 'picture', edge: 'entry' }, cut)).toEqual({ kind: 'in-cut', outputSec: 2.5 });
  });

  it('is gone once the layer is removed', () => {
    expect(at({ kind: 'layer', layerId: 'picture', edge: 'entry' }, contextOf({ shots: SHOTS.withoutLayers(['picture']) })))
      .toEqual({ kind: 'gone' });
  });
});

describe('a video anchor', () => {
  it('lands at zero and at the output\'s end, which the cuts shorten', () => {
    const cut = contextOf({ timeMap: new RenderTimeMap([{ startSec: 4, endSec: 5 }]) });

    expect(at({ kind: 'video', edge: 'start' }, cut)).toEqual({ kind: 'at', outputSec: 0 });
    expect(at({ kind: 'video', edge: 'end' }, cut)).toEqual({ kind: 'at', outputSec: 9 });
  });
});

describe('the offset', () => {
  it('is added on output time, either way', () => {
    expect(at({ kind: 'word', wordId: 'there', edge: 'start' }, contextOf(), -0.25)).toEqual({ kind: 'at', outputSec: 1.75 });
    expect(at({ kind: 'shot', shotId: 'second', edge: 'start' }, contextOf(), 0.5)).toEqual({ kind: 'at', outputSec: 3.5 });
  });
});

describe('a graphic\'s moment anchor', () => {
  const graphicShots = (moments: ReadonlyArray<{ id: string; label: string; sec: number }>) => contextOf({
    shots: ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [
        { id: 'first', startSec: 0 },
        {
          id: 'second',
          startSec: 3,
          layers: [{ id: 'card', graphic: { document: { html: '', css: '', js: '' }, fields: [], params: {}, aspectRatio: 3, moments, presetId: null, hidesCaptions: false } }],
        },
        { id: 'third', startSec: 6 },
      ],
    }),
  });
  const press = { kind: 'layer-moment', layerId: 'card', momentId: 'press' } as const;

  it('lands that many seconds after the graphic comes in', () => {
    expect(at(press, graphicShots([{ id: 'press', label: 'Button pressed', sec: 1.3 }]))).toEqual({ kind: 'at', outputSec: 4.3 });
  });

  it('follows the moment when the code declares it at another time', () => {
    expect(at(press, graphicShots([{ id: 'press', label: 'Button pressed', sec: 2 }]))).toEqual({ kind: 'at', outputSec: 5 });
  });

  it('is gone where the code no longer declares it, or it falls past the layer\'s end', () => {
    expect(at(press, graphicShots([]))).toEqual({ kind: 'gone' });
    expect(at(press, graphicShots([{ id: 'press', label: 'Button pressed', sec: 3 }]))).toEqual({ kind: 'gone' });
  });

  it('is gone on a layer that shows a file', () => {
    expect(at({ kind: 'layer-moment', layerId: 'picture', momentId: 'press' })).toEqual({ kind: 'gone' });
  });
});

describe('an emoji anchor', () => {
  const TEMPLATE = { styleControls: [], variants: [], metadata: { id: 't' }, effectConfigs: [], modes: BODY_ONLY_MODES } as unknown as Template;
  const WORD_TIMES: Readonly<Record<string, readonly [number, number]>> = { hello: [1, 1.5], there: [2, 2.5], friend: [4, 4.6] };
  // Transcription suggested the emojis on "hello" and "there"; the person added the one on "friend".
  const ADDED_ON_FRIEND = DecorationOverrideRegistry.empty().with('e-friend', { source: 'user' });

  function sheetShowingEmojis(enabled: boolean): Sheet {
    return Sheet.fromTemplate('main', 'main', null, TEMPLATE, 'ltr').with({
      effectConfigs: [{ type: 'emoji', enabled, placement: EMOJI_PLACEMENT_DEFAULT, size: EMOJI_SIZE_DEFAULT, gap: EMOJI_GAP_DEFAULT }],
    });
  }

  /** The words split into captions as `captions` groups them, each word carrying an emoji named after it: `hello` holds `e-hello`. */
  function captionsOf(captions: ReadonlyArray<ReadonlyArray<string>>, hiddenCaption: number | null = null): Document {
    return new Document({
      sections: [new Section({
        kind: 'main',
        segments: captions.map((wordIds, index) => new Segment({
          hidden: index === hiddenCaption,
          lines: [new Line({ words: wordIds.map((id) => new Word({
            id,
            text: id,
            time: new TimeFragment(...WORD_TIMES[id]!),
            decoration: new Decoration({ id: `e-${id}`, glyph: '🔥' }),
          })) })],
        })),
      })],
    });
  }

  function emojiContext(
    captions: Document,
    { automaticEmojis = true, overrides = ADDED_ON_FRIEND, cuts = new RenderTimeMap([]) } = {},
  ): AudioTimingContext {
    return contextOf({
      originalDocument: captions,
      originalSheets: [sheetShowingEmojis(automaticEmojis)],
      originalDecorationOverrides: overrides,
      timeMap: cuts,
    });
  }

  const onEmoji = (wordId: string): AudioAnchor => ({ kind: 'emoji', decorationId: `e-${wordId}` });

  it('plays where its word starts while the captions show it, moved by its offset', () => {
    const context = emojiContext(captionsOf([['hello'], ['there'], ['friend']]));

    expect(at(onEmoji('hello'), context)).toEqual({ kind: 'at', outputSec: 1 });
    expect(at(onEmoji('there'), context, -0.1)).toEqual({ kind: 'at', outputSec: 1.9 });
    expect(at(onEmoji('friend'), context)).toEqual({ kind: 'at', outputSec: 4 });
  });

  it('is silent where its caption shows a later one, and plays again once another split gives it a caption of its own', () => {
    const together = emojiContext(captionsOf([['hello', 'there'], ['friend']]));
    const apart = emojiContext(captionsOf([['hello'], ['there'], ['friend']]));

    expect(at(onEmoji('hello'), together)).toEqual({ kind: 'hidden', outputSec: 1 });
    expect(at(onEmoji('there'), together)).toEqual({ kind: 'at', outputSec: 2 });
    expect(at(onEmoji('hello'), apart)).toEqual({ kind: 'at', outputSec: 1 });
  });

  it('is silent where an emoji the person added takes its caption\'s place', () => {
    const context = emojiContext(captionsOf([['hello'], ['there', 'friend']]));

    expect(at(onEmoji('there'), context)).toEqual({ kind: 'hidden', outputSec: 2 });
    expect(at(onEmoji('friend'), context)).toEqual({ kind: 'at', outputSec: 4 });
  });

  it('is silent while automatic emojis are off, unless the person added it', () => {
    const context = emojiContext(captionsOf([['hello'], ['there'], ['friend']]), { automaticEmojis: false });

    expect(at(onEmoji('there'), context)).toEqual({ kind: 'hidden', outputSec: 2 });
    expect(at(onEmoji('friend'), context)).toEqual({ kind: 'at', outputSec: 4 });
  });

  it('is silent in a caption that is hidden', () => {
    expect(at(onEmoji('friend'), emojiContext(captionsOf([['hello'], ['there'], ['friend']], 2)))).toEqual({ kind: 'hidden', outputSec: 4 });
  });

  it('is in a cut where its word is cut away', () => {
    const context = emojiContext(captionsOf([['hello'], ['there'], ['friend']]), { cuts: new RenderTimeMap([{ startSec: 1.8, endSec: 2.8 }]) });

    expect(at(onEmoji('there'), context)).toEqual({ kind: 'in-cut', outputSec: 1.8 });
  });

  it('is gone once removed, or where no word holds it any more', () => {
    const removed = ADDED_ON_FRIEND.with('e-hello', { removed: true });
    const context = emojiContext(captionsOf([['hello'], ['there'], ['friend']]), { overrides: removed });

    expect(at(onEmoji('hello'), context)).toEqual({ kind: 'gone' });
    expect(at({ kind: 'emoji', decorationId: 'e-deleted' }, context)).toEqual({ kind: 'gone' });
  });
});
