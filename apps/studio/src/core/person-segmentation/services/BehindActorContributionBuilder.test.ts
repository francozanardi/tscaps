import { describe, expect, it } from 'vitest';
import { CssClass, Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { ExportRenderContext } from '@core/export/domain/ExportRenderContributor';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { BehindActorContributionBuilder } from '@core/person-segmentation/services/BehindActorContributionBuilder';
import { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerCoverage } from '@core/shots/services/ShotLayerCoverage';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

const NOT_OPTED_IN = { behindActor: { required: false, tagCondition: null } };

const NO_SHOTS = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [] });

/** Shots of 4 s, the second showing a 2 s b-roll from 4 s to 6 s. */
const BROLL_FROM_4_TO_6 = ShotPartition.fromSnapshot({
  maxShotSec: 6,
  shots: [
    { id: 'a', startSec: 0 },
    { id: 'b', startSec: 4, layers: [{ id: 'layer', mediaId: 'clip', inSec: 0, outSec: 2, loop: false }] },
    { id: 'c', startSec: 8 },
  ],
});

const CLIP_VIDEO = MediaAssetCatalog.of([{
  id: 'clip', type: 'video', owner: { kind: 'library' }, fileName: 'clip.mp4', mimeType: 'video/mp4',
  sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: 10,
}]);

function contextWith(
  segments: Segment[],
  overrides: BehindActorOverrideRegistry,
  shots: ShotPartition = NO_SHOTS,
  media: MediaAssetCatalog = CLIP_VIDEO,
): ExportRenderContext {
  return {
    document: new Document({ sections: [new Section({ id: 'sec', kind: 'main', segments })] }),
    originalDocument: null,
    originalSheets: [],
    originalDecorationOverrides: DecorationOverrideRegistry.empty(),
    sheets: [{ id: 'main', template: NOT_OPTED_IN } as unknown as Sheet],
    behindActorOverrides: overrides,
    projectId: null,
    shots,
    media,
    cuts: CutRegistry.fromSnapshot([]),
    audio: AudioMix.empty(),
    videoDurationSec: 12,
    frameLayout: null,
    outputFrame: OutputFrame.original(),
    colorGrade: ColorGrade.neutral(),
    signal: new AbortController().signal,
  };
}

const builder = new BehindActorContributionBuilder(
  new BehindActorGatingService(),
  new ShotLayerCoverage(new ShotLayerTiming(new ShotLayerAssetReader())),
);
const result = new PersonSegmentationResultAssembler(new PassingWindowFinder())
  .assemble(TimeRangeSet.of([{ start: 0, end: 12 }]), [], new MaskCache());

/**
 * What the export is told about the actor cutout when the user put one
 * word behind the person instead of a whole scene.
 *
 * The word is painted under the cutout and the rest of its scene over
 * it, and nothing about the scene moves — the template's lift reacts to
 * the scene's own activation, which a word must not trigger.
 */
function sceneOfThreeWords(startSec = 0): Segment {
  const words = ['w1', 'w2', 'w3'].map((id, i) => new Word({
    id,
    text: id,
    time: new TimeFragment(startSec + i, startSec + i + 1),
    ...(id === 'w3' ? { decoration: new Decoration({ id: 'w3:d', glyph: '🔥' }) } : {}),
  }));
  return new Segment({ id: 's1', lines: [new Line({ id: 'l1', words })] });
}

describe('a word put behind the person on its own', () => {
  it('is painted under the cutout, with its scene marked as holding one rather than as lifted', () => {
    const contribution = builder.build(contextWith([sceneOfThreeWords()], BehindActorOverrideRegistry.empty().with('w2', 'force-on')), result);
    expect([...contribution.elementsUnderTopLayer]).toEqual(['w2']);
    expect(contribution.segmentClasses.get('s1')).toEqual([CssClass.BEHIND_ACTOR_PARTIAL]);
    expect(contribution.topLayer).not.toBeNull();
  });

  it('has nothing left to add once its scene is behind the person', () => {
    const overrides = BehindActorOverrideRegistry.empty().with('w2', 'force-on').with('s1', 'force-on');
    const contribution = builder.build(contextWith([sceneOfThreeWords()], overrides), result);
    expect(contribution.elementsUnderTopLayer.size).toBe(0);
    expect(contribution.segmentClasses.get('s1')).toEqual([CssClass.BEHIND_ACTOR_ACTIVE]);
  });

  it('is not put there by anything but the user', () => {
    const contribution = builder.build(contextWith([sceneOfThreeWords()], BehindActorOverrideRegistry.empty()), result);
    expect(contribution.elementsUnderTopLayer.size).toBe(0);
    expect(contribution.segmentClasses.size).toBe(0);
  });
});

describe('an emoji put behind the person on its own', () => {
  it('is painted under the cutout like a word, while its word stays in front', () => {
    const contribution = builder.build(contextWith([sceneOfThreeWords()], BehindActorOverrideRegistry.empty().with('w3:d', 'force-on')), result);
    expect([...contribution.elementsUnderTopLayer]).toEqual(['w3:d']);
    expect(contribution.segmentClasses.get('s1')).toEqual([CssClass.BEHIND_ACTOR_PARTIAL]);
  });
});

/**
 * Text never goes behind the actor where a b-roll covers the video —
 * the actor is not on screen there — not even on a caption forced on.
 * A caption that only touches the b-roll is left out whole, since the
 * effect holds for a caption's whole length.
 */
describe('text behind the actor over a b-roll', () => {
  function segmentAt(startSec: number, endSec: number): Segment {
    return new Segment({ lines: [new Line({ words: [new Word({ text: 'word', time: new TimeFragment(startSec, endSec) })] })] });
  }

  it('stays off on captions over or touching a b-roll, even forced on, and on everywhere else', () => {
    const clear = segmentAt(0, 2);
    const inside = segmentAt(4.5, 5.5);
    const touching = segmentAt(3, 4.5);
    const afterIt = segmentAt(6.5, 7.5);
    const overrides = [clear, touching, inside, afterIt].reduce(
      (registry, segment) => registry.with(segment.id, 'force-on'),
      BehindActorOverrideRegistry.empty(),
    );

    const contribution = builder.build(
      contextWith([clear, touching, inside, afterIt], overrides, BROLL_FROM_4_TO_6),
      PersonSegmentationResult.nothingKnown(new MaskCache()),
    );

    expect([...contribution.segmentClasses.keys()]).toEqual([clear.id, afterIt.id]);
    expect(contribution.segmentClasses.get(clear.id)).toEqual([CssClass.BEHIND_ACTOR_ACTIVE]);
  });

  it('stays off under every layer of a shot, an inset or a split as much as a full one', () => {
    const insetThenSplit = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 4, layers: [
          { id: 'inset', mediaId: 'clip', inSec: 0, outSec: 1, loop: false },
          { id: 'split', mediaId: 'clip', inSec: 0, outSec: 3, loop: false },
        ] },
      ],
      layerStyles: {
        inset: { kind: 'layer', fields: { layout: '2' }, css: '--layer-layout: 2;' },
        split: { kind: 'layer', fields: { layout: '1' }, css: '--layer-layout: 1;' },
      },
    });
    const clear = segmentAt(0, 2);
    const underInset = segmentAt(4.2, 4.8);
    const underSplitOnly = segmentAt(5.5, 6.5);
    const afterBoth = segmentAt(7.5, 8);
    const overrides = [clear, underInset, underSplitOnly, afterBoth].reduce(
      (registry, segment) => registry.with(segment.id, 'force-on'),
      BehindActorOverrideRegistry.empty(),
    );

    const contribution = builder.build(
      contextWith([clear, underInset, underSplitOnly, afterBoth], overrides, insetThenSplit),
      PersonSegmentationResult.nothingKnown(new MaskCache()),
    );

    expect([...contribution.segmentClasses.keys()]).toEqual([clear.id, afterBoth.id]);
  });

  it('stays off under a picture or a GIF for its whole shot, whatever stretch was picked', () => {
    const still = (id: string, type: 'image' | 'gif') => ({
      id, type, owner: { kind: 'library' as const }, fileName: id, mimeType: '', sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: null,
    });
    const pictures = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 4, layers: [{ id: 'logo', mediaId: 'logo', inSec: 0, outSec: 0.5, loop: false }] },
        { id: 'c', startSec: 6, layers: [{ id: 'wave', mediaId: 'wave', inSec: 0, outSec: 0.5, loop: false }] },
        { id: 'd', startSec: 9 },
      ],
    });
    const clear = segmentAt(0, 2);
    const underPicture = segmentAt(5.2, 5.8);
    const underGif = segmentAt(8, 8.5);
    const afterBoth = segmentAt(10, 11);
    const overrides = [clear, underPicture, underGif, afterBoth].reduce(
      (registry, segment) => registry.with(segment.id, 'force-on'),
      BehindActorOverrideRegistry.empty(),
    );

    const contribution = builder.build(
      contextWith(
        [clear, underPicture, underGif, afterBoth],
        overrides,
        pictures,
        MediaAssetCatalog.of([still('logo', 'image'), still('wave', 'gif')]),
      ),
      PersonSegmentationResult.nothingKnown(new MaskCache()),
    );

    expect([...contribution.segmentClasses.keys()]).toEqual([clear.id, afterBoth.id]);
  });

  it('stays off on a word forced on in a scene the b-roll touches', () => {
    const contribution = builder.build(
      contextWith([sceneOfThreeWords(3)], BehindActorOverrideRegistry.empty().with('w2', 'force-on'), BROLL_FROM_4_TO_6),
      result,
    );
    expect(contribution.elementsUnderTopLayer.size).toBe(0);
    expect(contribution.segmentClasses.size).toBe(0);
  });
});
