import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { describe, expect, it } from 'vitest';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
const LOWER_THIRD_GRAPHIC_PRESET = new BuiltinGraphicPresetCatalog().starter();
const STARTER_GRAPHIC = LOWER_THIRD_GRAPHIC_PRESET.graphic;
import { PICTURE_LAYER_PLACEMENT } from '@core/shots/domain/PictureLayerPlacement';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotPartition, type ShotsSnapshot as ShotsSnapshotJson } from '@core/shots/domain/ShotPartition';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';

/**
 * The partition covers the video or it is not a partition: shots are
 * ordered, the first opens at zero, and every gesture leaves both true.
 */

const THREE = ShotPartition.empty().withProposal([0, 4, 9]);

function layerOf(mediaId: string, id = mediaId): ShotLayer {
  return { id, mediaId, inSec: 0, outSec: null, loop: false };
}

const layouts = new TestShotLayerLayouts().writer;

/** `partition` with the layer `layerId` laid out by `placement`, as the editor writes a layout. */
function laidOut(partition: ShotPartition, layerId: string, placement: ShotLayerPlacement): ShotPartition {
  return partition.withLayerStyles(layouts.written(partition.layerStyles, layerId, placement));
}

/** Gives each shot, in order, layers showing the files named. */
function withLayers(partition: ShotPartition, files: ReadonlyArray<ReadonlyArray<string>>): ShotPartition {
  return partition.list().reduce(
    (built, shot, index) => (files[index] ?? []).reduce((withLayer, mediaId) => withLayer.withLayerAdded(shot.id, layerOf(mediaId)), built),
    partition,
  );
}

const filesOf = (partition: ShotPartition) => partition.list().map((shot) => shot.layers.map((layer) => (layer as ShotFileLayer).mediaId));

const FULL: ShotLayerPlacement = { kind: 'full', fit: 'cover' };
const SPLIT: ShotLayerPlacement = { kind: 'split', assetSide: 'end', assetRatio: 0.6, padding: 0.02, cornerRadius: 0.03, fit: 'contain' };
const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.2, centerY: 0.8, width: 0.3, aspectRatio: 1, padding: 0.05, cornerRadius: 0.1, fit: 'cover',
};

describe('ShotPartition', () => {
  it('opens its first shot at zero however it was built', () => {
    expect(ShotPartition.empty().withProposal([3, 7]).list()[0]!.startSec).toBe(0);
    expect(ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 3 }] }).list()[0]!.startSec).toBe(0);
  });

  it('holds its shots in the order they play, whatever order they arrive in', () => {
    const partition = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [
      { id: 'c', startSec: 9 },
      { id: 'a', startSec: 0 },
      { id: 'b', startSec: 4 },
    ] });

    expect(partition.list().map((shot) => shot.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops what it cannot read back rather than holding a shot nothing can resolve', () => {
    const partition = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [
      { id: 'a', startSec: 0 },
      { id: 'b', startSec: Number.NaN },
      { id: 'c', startSec: -2 },
      { id: 'a', startSec: 6 },
      { id: '', startSec: 7 },
    ] });

    expect(partition.list().map((shot) => shot.id)).toEqual(['a']);
  });

  it('keeps the id of a shot wherever its opening is moved to', () => {
    const moved = THREE.moveStart(THREE.list()[1]!.id, 6);

    expect(moved.list()[1]!.id).toBe(THREE.list()[1]!.id);
    expect(moved.list()[1]!.startSec).toBe(6);
  });

  it('refuses a move that would cross a neighbour instead of clamping it', () => {
    const middle = THREE.list()[1]!.id;

    expect(THREE.moveStart(middle, 9)).toBe(THREE);
    expect(THREE.moveStart(middle, 0)).toBe(THREE);
  });

  it('never moves the first shot, which has nothing before it', () => {
    expect(THREE.moveStart(THREE.list()[0]!.id, 2)).toBe(THREE);
  });

  it('gives what a joined shot held to the shot before it', () => {
    const joined = THREE.joinIntoPrevious(THREE.list()[1]!.id);

    expect(joined.list().map((shot) => shot.startSec)).toEqual([0, 9]);
  });

  it('never joins the first shot into nothing', () => {
    expect(THREE.joinIntoPrevious(THREE.list()[0]!.id)).toBe(THREE);
    expect(THREE.joinIntoPrevious('no such shot')).toBe(THREE);
  });

  it('splits where no shot opens yet, and nowhere else', () => {
    expect(THREE.splitAt(6, 'new').list().map((shot) => shot.startSec)).toEqual([0, 4, 6, 9]);
    expect(THREE.splitAt(4, 'new')).toBe(THREE);
    expect(THREE.splitAt(0, 'new')).toBe(THREE);
  });

  it('carries its length through every gesture, so a join never resets the dial', () => {
    const long = ShotPartition.empty().reproposed(12).withProposal([0, 4, 9]);

    expect(long.joinIntoPrevious(long.list()[1]!.id).maxShotSec).toBe(12);
    expect(long.splitAt(6, 'new').maxShotSec).toBe(12);
  });

  it('answers which shot covers a time', () => {
    expect(THREE.at(5)!.startSec).toBe(4);
    expect(THREE.at(0)!.startSec).toBe(0);
    expect(ShotPartition.empty().at(5)).toBeNull();
  });

  describe('layers', () => {
    it('keeps the earlier shot\'s layers in a join and puts the later one\'s on top', () => {
      const partition = withLayers(THREE, [[], ['first', 'second'], ['third']]);

      expect(filesOf(partition.joinIntoPrevious(partition.list()[2]!.id))).toEqual([[], ['first', 'second', 'third']]);
    });

    it('takes the later shot\'s layers into a join when the earlier had none', () => {
      const partition = withLayers(THREE, [[], [], ['later']]);

      expect(filesOf(partition.joinIntoPrevious(partition.list()[2]!.id))).toEqual([[], ['later']]);
    });

    it('opens a split\'s new shot with no layer of its own, the split shot\'s still showing on it', () => {
      const partition = withLayers(THREE, [[], ['under', 'over'], []]);

      const split = partition.splitAt(6, 'new');

      expect(filesOf(split)).toEqual([[], ['under', 'over'], [], []]);
      expect(split.layersContinuingInto('new').map((layer) => layer.id)).toEqual(['under', 'over']);
    });

    it('keeps the layers wherever their shot\'s opening is moved to', () => {
      const partition = withLayers(THREE, [[], ['middle'], []]);

      expect(filesOf(partition.moveStart(partition.list()[1]!.id, 6))).toEqual([[], ['middle'], []]);
    });

    it('loses every layer when the shots are proposed again', () => {
      expect(withLayers(THREE, [['a'], ['b'], ['c']]).reproposed(10).list()).toEqual([]);
    });

    it('stacks a new layer on top, and refuses one reusing an id or naming no shot', () => {
      const partition = withLayers(THREE, [['under'], [], []]);
      const shotId = partition.list()[0]!.id;

      expect(filesOf(partition.withLayerAdded(shotId, layerOf('over')))[0]).toEqual(['under', 'over']);
      expect(partition.withLayerAdded(partition.list()[1]!.id, layerOf('other', 'under'))).toBe(partition);
      expect(partition.withLayerAdded('no such shot', layerOf('other'))).toBe(partition);
    });

    it('replaces a layer where it stands, and takes one away', () => {
      const partition = withLayers(THREE, [['under', 'over'], [], []]);

      expect(filesOf(partition.withLayerReplaced({ ...layerOf('swapped', 'under') }))[0]).toEqual(['swapped', 'over']);
      expect(filesOf(partition.withoutLayers(['under']))[0]).toEqual(['over']);
      expect(partition.withoutLayers(['no such layer'])).toBe(partition);
    });

    it('takes several layers away across the shots at once', () => {
      const partition = withLayers(THREE, [['under', 'over'], ['middle'], ['last']]);

      expect(filesOf(partition.withoutLayers(['over', 'middle', 'no such layer']))).toEqual([['under'], [], ['last']]);
    });

    it('replaces several layers across the shots at once, each where it stands, and skips one no shot holds', () => {
      const partition = withLayers(THREE, [['under', 'over'], ['middle'], []]);

      const replaced = partition.withLayersReplaced([
        { ...layerOf('under'), loop: true },
        { ...layerOf('middle'), inSec: 2 },
        { ...layerOf('nowhere'), loop: true },
      ]);

      expect((replaced.findLayer('under') as ShotFileLayer | null)?.loop).toBe(true);
      expect((replaced.findLayer('middle') as ShotFileLayer | null)?.inSec).toBe(2);
      expect(replaced.findLayer('nowhere')).toBeNull();
      expect(filesOf(replaced)).toEqual(filesOf(partition));
    });

    it('changes nothing when every layer given is the one already there', () => {
      const partition = withLayers(THREE, [['under'], [], []]);

      expect(partition.withLayersReplaced([layerOf('under')])).toBe(partition);
    });

    it('takes a file off every layer that shows it, and leaves the others', () => {
      const [first, second, third] = THREE.list();
      const partition = THREE
        .withLayerAdded(first!.id, layerOf('gone', 'gone 1'))
        .withLayerAdded(second!.id, layerOf('kept'))
        .withLayerAdded(second!.id, layerOf('gone', 'gone 2'))
        .withLayerAdded(third!.id, layerOf('gone', 'gone 3'));
      const withoutGone = partition.withoutMedia('gone');

      expect(filesOf(withoutGone)).toEqual([[], ['kept'], []]);
      expect(withoutGone.mediaIdsInUse()).toEqual(new Set(['kept']));
    });
  });

  describe('runs', () => {
    const [FIRST, SECOND, THIRD] = THREE.list().map((shot) => shot.id) as [string, string, string];
    const shotsOf = (partition: ShotPartition, layerId: string) => partition.runOf(layerId).map((shot) => shot.id);

    it('shows a layer on its own shot until it is told to show through a later one', () => {
      const partition = THREE.withLayerAdded(FIRST, layerOf('logo'));

      expect(shotsOf(partition, 'logo')).toEqual([FIRST]);
      expect(shotsOf(partition.withLayerThrough('logo', THIRD), 'logo')).toEqual([FIRST, SECOND, THIRD]);
      expect(shotsOf(partition.withLayerThrough('logo', THIRD).withLayerThrough('logo', SECOND), 'logo')).toEqual([FIRST, SECOND]);
      expect(shotsOf(partition.withLayerThrough('logo', THIRD).withLayerThrough('logo', null), 'logo')).toEqual([FIRST]);
    });

    it('refuses a run that ends before the layer\'s own shot, on a shot it does not hold, or of a layer no shot holds', () => {
      const partition = THREE.withLayerAdded(SECOND, layerOf('logo'));

      expect(partition.withLayerThrough('logo', FIRST)).toBe(partition);
      expect(partition.withLayerThrough('logo', 'nowhere')).toBe(partition);
      expect(partition.withLayerThrough('nothing', THIRD)).toBe(partition);
      expect(partition.withLayerThrough('logo', null)).toBe(partition);
    });

    it('says which layers of earlier shots still show on a shot, files beneath graphics', () => {
      const partition = THREE
        .withLayerAdded(FIRST, { id: 'card', graphic: STARTER_GRAPHIC })
        .withLayerAdded(FIRST, layerOf('logo'))
        .withLayerAdded(SECOND, layerOf('clip'))
        .withLayerThrough('card', THIRD)
        .withLayerThrough('logo', SECOND)
        .withLayerThrough('clip', THIRD);

      expect(partition.layersContinuingInto(FIRST)).toEqual([]);
      expect(partition.layersContinuingInto(SECOND).map((layer) => layer.id)).toEqual(['logo', 'card']);
      expect(partition.layersContinuingInto(THIRD).map((layer) => layer.id)).toEqual(['clip', 'card']);
    });

    it('covers the same stretch after a shot is opened inside the run, or inside the layer\'s own shot', () => {
      const partition = THREE.withLayerAdded(FIRST, layerOf('long')).withLayerAdded(THIRD, layerOf('short')).withLayerThrough('long', SECOND);

      expect(shotsOf(partition.splitAt(2, 'early'), 'long')).toEqual([FIRST, 'early', SECOND]);
      expect(shotsOf(partition.splitAt(6, 'late'), 'long')).toEqual([FIRST, SECOND, 'late']);
      expect(shotsOf(partition.splitAt(12, 'after'), 'long')).toEqual([FIRST, SECOND]);
      expect(shotsOf(partition.splitAt(12, 'after'), 'short')).toEqual([THIRD, 'after']);
    });

    it('covers the same stretch after a shot of the run is joined into the one before', () => {
      const partition = THREE.withLayerAdded(FIRST, layerOf('long')).withLayerThrough('long', THIRD);

      expect(shotsOf(partition.joinIntoPrevious(SECOND), 'long')).toEqual([FIRST, THIRD]);
      expect(shotsOf(partition.joinIntoPrevious(THIRD), 'long')).toEqual([FIRST, SECOND]);
      expect(shotsOf(partition.joinIntoPrevious(THIRD).joinIntoPrevious(SECOND), 'long')).toEqual([FIRST]);
    });

    it('keeps how far a layer shows when the layer is replaced', () => {
      const partition = THREE.withLayerAdded(FIRST, layerOf('old', 'layer')).withLayerThrough('layer', THIRD);

      expect(shotsOf(partition.withLayerReplaced(layerOf('new', 'layer')), 'layer')).toEqual([FIRST, SECOND, THIRD]);
      expect(shotsOf(partition.withLayersReplaced([layerOf('new', 'layer')]), 'layer')).toEqual([FIRST, SECOND, THIRD]);
    });

    it('survives a save and a load, and reads a stored run naming no later shot as the layer\'s own shot', () => {
      const partition = THREE.withLayerAdded(FIRST, layerOf('long')).withLayerThrough('long', THIRD);
      const loaded = ShotPartition.fromSnapshot(JSON.parse(JSON.stringify(partition.toSnapshot())) as ShotsSnapshotJson);
      const stray = ShotPartition.fromSnapshot({
        maxShotSec: 6,
        shots: [
          { id: 'a', startSec: 0, layers: [{ ...layerOf('gone'), throughShotId: 'deleted' }] },
          { id: 'b', startSec: 4, layers: [{ ...layerOf('backwards'), throughShotId: 'a' }, { ...layerOf('itself'), throughShotId: 'b' }] },
        ],
      });

      expect(shotsOf(loaded, 'long')).toEqual([FIRST, SECOND, THIRD]);
      expect(stray.list().flatMap((shot) => shot.layers.map((layer) => layer.throughShotId))).toEqual([undefined, undefined, undefined]);
    });

    it('moves a layer to another opening shot, the same layer, and refuses shots it cannot take', () => {
      const partition = THREE
        .withLayerAdded(SECOND, layerOf('clip'))
        .withLayerAdded(SECOND, { id: 'card', graphic: STARTER_GRAPHIC })
        .withLayerAdded(FIRST, layerOf('opening'));
      const moved = partition.withLayerMoved('card', FIRST, THIRD);

      expect(shotsOf(moved, 'card')).toEqual([FIRST, SECOND, THIRD]);
      expect(moved.findLayer('card')).toEqual({ id: 'card', graphic: STARTER_GRAPHIC, throughShotId: THIRD });
      expect(moved.list().map((shot) => shot.layers.map((layer) => layer.id))).toEqual([['opening', 'card'], ['clip'], []]);
      expect(shotsOf(partition.withLayerMoved('card', THIRD, null), 'card')).toEqual([THIRD]);
      expect(partition.withLayerMoved('card', THIRD, FIRST)).toBe(partition);
      expect(partition.withLayerMoved('card', 'nowhere', null)).toBe(partition);
      expect(partition.withLayerMoved('card', SECOND, null)).toBe(partition);
    });

    it('has a layer show over the whole video from wherever it was, and goes on doing so through splits and joins', () => {
      const partition = THREE
        .withLayerAdded(FIRST, layerOf('opening'))
        .withLayerAdded(SECOND, { id: 'card', graphic: STARTER_GRAPHIC })
        .withLayerAdded(SECOND, layerOf('logo'))
        .withLayerOverWholeVideo('logo');

      expect(shotsOf(partition, 'logo')).toEqual([FIRST, SECOND, THIRD]);
      expect(partition.list()[0]!.layers.map((layer) => layer.id)).toEqual(['opening', 'logo']);
      expect(partition.wholeVideoLayers().map((layer) => layer.id)).toEqual(['logo']);
      expect(partition.showsOverWholeVideo('opening')).toBe(false);
      expect(partition.withLayerOverWholeVideo('logo')).toBe(partition);
      expect(partition.splitAt(11, 'tail').showsOverWholeVideo('logo')).toBe(true);
      expect(partition.splitAt(2, 'head').joinIntoPrevious(THIRD).showsOverWholeVideo('logo')).toBe(true);
      expect(partition.withLayerThrough('logo', SECOND).showsOverWholeVideo('logo')).toBe(false);
    });

    it('says nothing shows over the whole video where the video is one shot', () => {
      const single = ShotPartition.empty().withProposal([0]);
      const only = single.list()[0]!.id;

      expect(single.withLayerAdded(only, layerOf('logo')).showsOverWholeVideo('logo')).toBe(false);
    });

    it('keeps the captions off every shot a graphic that hides them shows on, as one stretch', () => {
      const hiding = (id: string): ShotLayer => ({ id, graphic: { ...STARTER_GRAPHIC, hidesCaptions: true } });
      const partition = THREE.withLayerAdded(FIRST, hiding('hook')).withLayerThrough('hook', SECOND);

      expect(partition.captionlessSpans(12)).toEqual([{ startSec: 0, endSec: 9 }]);
      expect(partition.withLayerAdded(THIRD, hiding('other')).captionlessSpans(12))
        .toEqual([{ startSec: 0, endSec: 9 }, { startSec: 9, endSec: 12 }]);
    });
  });

  describe('a shot\'s own video over several shots', () => {
    const [FIRST, SECOND, THIRD] = THREE.list().map((shot) => shot.id) as [string, string, string];
    const CAMERA = { presetId: 'layer-zoom-in-camera', params: {} };
    /** `partition` with a camera on the own video of each of `shotIds`. */
    const withCamera = (partition: ShotPartition, ...shotIds: string[]) => partition.withLayerStyles(shotIds.reduce(
      (styles, shotId) => styles.withAnimation(`shot-video-${shotId}`, 'layer', ElementAnimationScope.CAMERA, CAMERA, 'scale: 1.2;'),
      partition.layerStyles,
    ));
    const drawnOver = (partition: ShotPartition, shotId: string) => partition.videoRunOf(shotId).map((shot) => shot.id);
    const drawnBy = (partition: ShotPartition) => partition.list().map((shot) => partition.videoShotOf(shot.id)?.id);

    it('draws a styled video through a later shot, the shots in between drawing none of their own', () => {
      const partition = withCamera(THREE, FIRST).withVideoThrough(FIRST, THIRD);

      expect(drawnOver(partition, FIRST)).toEqual([FIRST, SECOND, THIRD]);
      expect(drawnBy(partition)).toEqual([FIRST, FIRST, FIRST]);
      expect(drawnBy(partition.withVideoThrough(FIRST, SECOND))).toEqual([FIRST, FIRST, THIRD]);
      expect(drawnBy(partition.withVideoThrough(FIRST, null))).toEqual([FIRST, SECOND, THIRD]);
    });

    it('gives no run to a video with no style, nor one that ends before its own shot', () => {
      expect(THREE.withVideoThrough(FIRST, THIRD).list().map((shot) => shot.videoThroughShotId)).toEqual([undefined, undefined, undefined]);
      const styled = withCamera(THREE, SECOND);
      expect(styled.withVideoThrough(SECOND, FIRST)).toBe(styled);
    });

    it('stops a run before a shot whose video takes a style of its own', () => {
      const partition = withCamera(THREE, FIRST).withVideoThrough(FIRST, THIRD);

      expect(drawnBy(withCamera(partition, THIRD))).toEqual([FIRST, FIRST, THIRD]);
      expect(drawnBy(withCamera(partition, SECOND))).toEqual([FIRST, SECOND, THIRD]);
    });

    it('keeps a styled video over both halves of a split, and over what it was joined with', () => {
      const partition = withCamera(THREE, SECOND);

      expect(drawnBy(partition.splitAt(6, 'half'))).toEqual([FIRST, SECOND, SECOND, THIRD]);
      expect(drawnBy(partition.splitAt(2, 'plain'))).toEqual([FIRST, 'plain', SECOND, THIRD]);
      expect(drawnBy(partition.withVideoThrough(SECOND, THIRD).splitAt(11, 'tail'))).toEqual([FIRST, SECOND, SECOND, SECOND]);
      expect(drawnBy(partition.withVideoThrough(SECOND, THIRD).joinIntoPrevious(THIRD))).toEqual([FIRST, SECOND]);
    });

    describe('that holds still: a framing, a punch-in', () => {
      const HELD = { presetId: 'layer-punch-in-camera', params: {} };
      const framed = (partition: ShotPartition, ...shotIds: string[]) => partition.withLayerStyles(shotIds.reduce(
        (styles, shotId) => styles.withAnimation(`shot-video-${shotId}`, 'layer', ElementAnimationScope.CAMERA, HELD, 'scale: 1.5;'),
        partition.layerStyles,
      ));
      const styleOf = (partition: ShotPartition, shotId: string) => partition.layerStyles.get(`shot-video-${shotId}`);

      it('gives the new shot of a split the same video as its own, so each half keeps it whatever is done to the other', () => {
        const partition = framed(THREE, SECOND).splitAt(6, 'half');

        expect(drawnBy(partition)).toEqual([FIRST, SECOND, 'half', THIRD]);
        expect(styleOf(partition, 'half')).toEqual(styleOf(partition, SECOND));
        expect(styleOf(partition.withVideoThrough(SECOND, null), 'half')).toEqual(styleOf(partition, SECOND));
        expect(styleOf(partition.joinIntoPrevious(SECOND), 'half')).toEqual(styleOf(partition, SECOND));
      });

      it('leaves the last third framed when the middle of a shot split in three takes a camera of its own', () => {
        const partition = withCamera(framed(THREE, SECOND).splitAt(5, 'middle').splitAt(7, 'last'), 'middle');

        expect(drawnBy(partition)).toEqual([FIRST, SECOND, 'middle', 'last', THIRD]);
        expect(styleOf(partition, 'last')).toEqual(styleOf(partition, SECOND));
      });

      it('hands the rest of a run to the new shot when the split falls inside it', () => {
        const partition = framed(THREE, FIRST).withVideoThrough(FIRST, THIRD).splitAt(6, 'half');

        expect(drawnBy(partition)).toEqual([FIRST, FIRST, 'half', 'half']);
        expect(styleOf(partition, 'half')).toEqual(styleOf(partition, FIRST));
      });
    });

    it('leaves the shots a joined shot\'s video ran on over drawing that video, the first of them as its own', () => {
      const partition = withCamera(THREE, SECOND).withVideoThrough(SECOND, THIRD).splitAt(11, 'tail');
      const joined = partition.joinIntoPrevious(SECOND);

      expect(drawnBy(joined)).toEqual([FIRST, THIRD, THIRD]);
      expect(joined.layerStyles.animationOf(`shot-video-${THIRD}`, ElementAnimationScope.CAMERA)).toEqual(partition.layerStyles.animationOf(`shot-video-${SECOND}`, ElementAnimationScope.CAMERA));
      expect(joined.layerStyles.has(`shot-video-${SECOND}`)).toBe(false);
    });

    it('gives a joined shot\'s video to nothing when it ended with that shot', () => {
      const joined = withCamera(THREE, SECOND).joinIntoPrevious(SECOND);

      expect(drawnBy(joined)).toEqual([FIRST, THIRD]);
      expect(joined.layerStyles.has(`shot-video-${THIRD}`)).toBe(false);
    });

    it('survives a save and a load', () => {
      const partition = withCamera(THREE, FIRST).withVideoThrough(FIRST, SECOND);
      const loaded = ShotPartition.fromSnapshot(JSON.parse(JSON.stringify(partition.toSnapshot())) as ShotsSnapshotJson);

      expect(drawnBy(loaded)).toEqual([FIRST, FIRST, THIRD]);
    });
  });

  describe('graphics', () => {
    const graphic = (id: string): ShotLayer => ({ id, graphic: STARTER_GRAPHIC });

    it('keeps the captions off each shot a graphic that hides them sits on, to the next shot or the end', () => {
      const hiding = (id: string): ShotLayer => ({ id, graphic: { ...STARTER_GRAPHIC, hidesCaptions: true } });
      const partition = ShotPartition.fromSnapshot({
        maxShotSec: 6,
        shots: [
          { id: 'a', startSec: 0, layers: [hiding('hook')] },
          { id: 'b', startSec: 2.5, layers: [graphic('card')] },
          { id: 'c', startSec: 5, layers: [hiding('end')] },
        ],
      });

      expect(partition.captionlessSpans(9)).toEqual([{ startSec: 0, endSec: 2.5 }, { startSec: 5, endSec: 9 }]);
    });
    const kindsOf = (partition: ShotPartition) => partition.list().map((shot) => shot.layers.map((layer) => ('graphic' in layer ? layer.id : (layer as ShotFileLayer).mediaId)));

    it('keeps a graphic above every file: one added after it goes beneath it', () => {
      const shot = THREE.list()[0]!.id;
      const partition = THREE.withLayerAdded(shot, layerOf('broll')).withLayerAdded(shot, graphic('title')).withLayerAdded(shot, layerOf('logo'));

      expect(kindsOf(partition)[0]).toEqual(['broll', 'logo', 'title']);
    });

    it('keeps the graphics of both shots above every file in a join', () => {
      const [first, second] = THREE.list();
      const partition = THREE.withLayerAdded(first!.id, graphic('title')).withLayerAdded(second!.id, layerOf('logo')).joinIntoPrevious(second!.id);

      expect(kindsOf(partition)[0]).toEqual(['logo', 'title']);
    });

    it('survives a save and a load, above the files whatever order it was stored in', () => {
      const stored = ShotPartition.fromSnapshot({
        maxShotSec: 6,
        shots: [{ id: 'a', startSec: 0, layers: [graphic('title'), layerOf('logo')] }],
      });
      const reloaded = ShotPartition.fromSnapshot(JSON.parse(JSON.stringify(stored.toSnapshot())) as ShotsSnapshotJson);

      expect(kindsOf(reloaded)[0]).toEqual(['logo', 'title']);
      expect(reloaded.findLayer('title')).toEqual(graphic('title'));
      expect(reloaded.hasGraphics()).toBe(true);
      expect(reloaded.mediaIdsInUse()).toEqual(new Set(['logo']));
    });

    it('drops a stored graphic with no document, and keeps of one only what can be trusted', () => {
      const partition = ShotPartition.fromSnapshot({
        maxShotSec: 6,
        shots: [{ id: 'a', startSec: 0, layers: [
          { id: 'none', graphic: { fields: [] } },
          { id: 'odd', graphic: {
            document: { html: '<b>x</b>', css: 3 },
            fields: [{ id: 'title', kind: 'text', defaultValue: 'Hi' }, { id: 'title', kind: 'text', defaultValue: 'Again' }, { id: 'size', kind: 'slider', defaultValue: 1 }],
            params: { title: 5, other: 'x' },
            aspectRatio: 400,
            moments: [
              { id: 'like', label: 'Liked', sec: 2 },
              { id: 'press', sec: 1.3 },
              { id: 'press', label: 'Again', sec: 1 },
              { id: 'with space', label: 'Bad id', sec: 1 },
              { id: 'early', label: 'Before it', sec: -1 },
            ],
          } },
        ] as unknown as ShotLayer[] }],
      });

      expect(partition.findLayer('none')).toBeNull();
      expect(partition.findLayer('odd')).toEqual({ id: 'odd', graphic: {
        document: { html: '<b>x</b>', css: '', js: '' },
        fields: [{ id: 'title', label: 'title', kind: 'text', defaultValue: 'Hi' }],
        params: {},
        aspectRatio: 50,
        moments: [{ id: 'press', label: 'press', sec: 1.3 }, { id: 'like', label: 'Liked', sec: 2 }],
        presetId: null,
        hidesCaptions: false,
      } });
    });
  });

  describe('placement', () => {
    const partition = withLayers(THREE, [['first'], ['second'], ['third']]);
    const placementsOf = (built: ShotPartition) => built.list().flatMap((shot) => shot.layers.map((layer) => [layer.id, built.placementOf(layer.id).kind]));

    it('starts a b-roll on the full frame and a picture in a box, until a layer of their role is edited', () => {
      expect(ShotPartition.empty().placementForNewLayer('video')).toEqual(FULL);
      expect(ShotPartition.empty().placementForNewLayer('picture')).toEqual(PICTURE_LAYER_PLACEMENT);
    });

    it('reads each layer\'s layout off its own fields, and a layer whose fields name none as on the full frame', () => {
      const laid = laidOut(laidOut(partition, 'second', SPLIT), 'third', INSET);

      expect(placementsOf(laid)).toEqual([['first', 'full'], ['second', 'split'], ['third', 'inset']]);
      expect([laid.placementOf('second'), laid.placementOf('third')]).toEqual([SPLIT, INSET]);
      expect(laid.placementOf('no such layer')).toEqual(FULL);
    });

    it('reads every setting its fields hold clamped into its range', () => {
      const wild = laidOut(partition, 'second', { ...SPLIT, assetRatio: 0.95, padding: -1, cornerRadius: 3 });

      expect(wild.placementOf('second')).toEqual({ ...SPLIT, assetRatio: 0.7, padding: 0, cornerRadius: 0.5 });
    });

    it('remembers a role\'s last edited placement for new layers, moving no layer and leaving the other role\'s alone', () => {
      const remembered = partition.withLastEditedPlacement('picture', SPLIT);

      expect(remembered.placementForNewLayer('picture')).toEqual(SPLIT);
      expect(remembered.placementForNewLayer('video')).toEqual(FULL);
      expect(placementsOf(remembered)).toEqual(placementsOf(partition));
    });

    it('changes nothing when the placement remembered is the one already remembered', () => {
      expect(partition.withLastEditedPlacement('video', { ...FULL })).toBe(partition);
    });

    it('keeps the last edited placements when the shots are proposed again', () => {
      const remembered = partition.withLastEditedPlacement('video', INSET);

      expect(remembered.reproposed(10).placementForNewLayer('video')).toEqual(INSET);
    });
  });

  describe('storage', () => {
    it('stores nothing for a partition nobody touched, and something once only a last edited placement changed', () => {
      expect(ShotPartition.empty().isPristine()).toBe(true);
      expect(ShotPartition.empty().toSnapshot()).toEqual({ maxShotSec: 4, shots: [] });
      expect(ShotPartition.empty().withLastEditedPlacement('picture', INSET).isPristine()).toBe(false);
    });

    it('stores only the last edited layouts that differ from the fresh ones, as the fields a layer holds them in', () => {
      const snapshot = ShotPartition.empty().withLastEditedPlacement('picture', INSET).toSnapshot();

      expect(snapshot.lastEditedLayouts).toEqual({ picture: layouts.written(ElementStyles.empty(), 'x', INSET).get('x')!.fields });
    });

    it('survives a save and a load: layers, their order, their layouts and the last edited layouts', () => {
      const partition = laidOut(withLayers(THREE, [[], ['under', 'over'], []]), 'over', INSET)
        .withLastEditedPlacement('video', SPLIT);

      const reloaded = ShotPartition.fromSnapshot(JSON.parse(JSON.stringify(partition.toSnapshot())) as ShotsSnapshotJson);

      expect(reloaded.list()).toEqual(partition.list());
      expect(reloaded.placementOf('over')).toEqual(INSET);
      expect(reloaded.placementForNewLayer('video')).toEqual(SPLIT);
      expect(reloaded.placementForNewLayer('picture')).toEqual(PICTURE_LAYER_PLACEMENT);
    });

    it('drops a stored layer it cannot trust, and keeps what it can of the rest', () => {
      const partition = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [
        { id: 'a', startSec: 0, layers: [
          { ...layerOf(''), id: 'no file' },
          { ...layerOf('clip'), id: '' },
          { ...layerOf('clip', 'kept'), inSec: 2, outSec: 1 },
        ] },
        { id: 'b', startSec: 4, layers: [
          { ...layerOf('clip', 'kept') },
          { ...layerOf('clip', 'clamped') },
        ] },
        { id: 'c', startSec: 8, layers: 'not a list' as unknown as ShotLayer[] },
      ], layerStyles: {
        clamped: { kind: 'layer', fields: { layout: '2', width: 9, 'center-x': 'left' }, css: '' },
      }, lastEditedLayouts: {
        video: layouts.written(ElementStyles.empty(), 'x', SPLIT).get('x')!.fields!,
        picture: { layout: 'nothing' },
      } });

      expect(partition.list()[0]!.layers).toEqual([{ ...layerOf('clip', 'kept'), inSec: 2, outSec: null }]);
      expect(partition.list()[1]!.layers.map((layer) => layer.id)).toEqual(['clamped']);
      expect(partition.placementOf('clamped')).toMatchObject({ kind: 'inset', subject: 'asset', width: 1, centerX: 0.5 });
      expect(partition.list()[2]!.layers).toEqual([]);
      expect(partition.placementForNewLayer('video')).toEqual(SPLIT);
      expect(partition.placementForNewLayer('picture')).toEqual(PICTURE_LAYER_PLACEMENT);
    });

    it('puts a layer whose style holds no layout on the full frame, whatever was edited last', () => {
      const partition = ShotPartition.fromSnapshot({
        maxShotSec: 6,
        shots: [{ id: 'a', startSec: 0, layers: [layerOf('clip')] }],
        lastEditedLayouts: { video: layouts.written(ElementStyles.empty(), 'x', INSET).get('x')!.fields! },
      });

      expect(partition.placementOf('clip')).toEqual(FULL);
    });

  });

  describe('layer styles', () => {
    const FADE = { presetId: 'layer-fade-entrance', params: { duration: 0.5 } };
    const styled = (partition: ShotPartition, layerId: string): ShotPartition =>
      partition.withLayerStyles(partition.layerStyles.withAnimation(layerId, 'layer', ElementAnimationScope.ENTRANCE, FADE, '--x: 1;'));

    it('survives a save and a load', () => {
      const partition = styled(withLayers(THREE, [['clip']]), 'clip');

      const reloaded = ShotPartition.fromSnapshot(JSON.parse(JSON.stringify(partition.toSnapshot())) as ShotsSnapshotJson);

      expect(reloaded.layerStyles.animationOf('clip', ElementAnimationScope.ENTRANCE)).toEqual(FADE);
      expect(reloaded.layerStyles.get('clip')?.css).toBe('--x: 1;');
    });

    it('goes with its layer: removed, its file deleted, or the shots proposed again', () => {
      const partition = styled(styled(withLayers(THREE, [['clip'], ['other']]), 'clip'), 'other');

      expect(partition.withoutLayers(['clip']).layerStyles.has('clip')).toBe(false);
      expect(partition.withoutLayers(['clip']).layerStyles.has('other')).toBe(true);
      expect(partition.withoutMedia('other').layerStyles.has('other')).toBe(false);
      expect(partition.reproposed(4).layerStyles.isEmpty()).toBe(true);
    });

    it('stays with its layer through a join', () => {
      const partition = styled(withLayers(THREE, [[], ['clip']]), 'clip');

      expect(partition.joinIntoPrevious(partition.list()[1]!.id).layerStyles.has('clip')).toBe(true);
    });

    it('reads only stored styles of the layer kind, of layers some shot holds', () => {
      const partition = ShotPartition.fromSnapshot({
        maxShotSec: 6,
        shots: [{ id: 'a', startSec: 0, layers: [layerOf('clip')] }],
        layerStyles: {
          clip: { kind: 'layer', css: '--x: 1;' },
          gone: { kind: 'layer', css: '--x: 1;' },
          w1: { kind: 'word', css: 'color: red;' },
        },
      });

      expect([...partition.layerStyles.elementIds()]).toEqual(['clip']);
    });

    it('keeps nothing for a partition with no shots, so it stays pristine', () => {
      expect(ShotPartition.empty().withLayerStyles(ElementStyles.empty().withCss('clip', 'layer', '--x: 1;')).isPristine()).toBe(true);
    });
  });
});
