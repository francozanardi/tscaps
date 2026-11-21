import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@tscaps/engine';
import { type FootageLayerFrameState, type FootageRect } from '@tscaps/engine/advanced';
import type { ScheduledShotLayer } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerHitTargetResolver, type ShotLayersDrawn } from '@presentation/shots/services/ShotLayerHitTargetResolver';

/**
 * What a press on the preview can pick among the shot layers: only a
 * box over the video, only while it shows and is drawn, never one a
 * full-screen layer hides, in the order they are drawn so the one on top
 * is the one a press lands on — and where its box rests, as the stage
 * resolves it, not where its motion has it at the instant.
 */

const resolver = new ShotLayerHitTargetResolver();
const VERTICAL = { width: 1080, height: 1920 };

const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.3, centerY: 0.2, width: 0.4, aspectRatio: 1, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};
const FULL: ShotLayerPlacement = { kind: 'full', fit: 'cover' };
const SPLIT: ShotLayerPlacement = {
  kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover',
};
const BOX_RECT: FootageRect = { x: 0.1, y: 0.2 - 0.1125, width: 0.4, height: 0.225 };
const WHOLE_FRAME: FootageRect = { x: 0, y: 0, width: 1, height: 1 };

function scheduled(id: string, startSec = 0, endSec = 4): ScheduledShotLayer {
  return {
    layer: { id, mediaId: `${id}-file`, inSec: 0, outSec: null, loop: false },
    stretch: { outputStartSec: startSec, outputEndSec: endSec, sourceStartSec: 0, sourcePassSec: endSec - startSec },
    asset: { kind: 'video', durationSec: 10, aspectRatio: 16 / 9 },
  };
}

/** A state of `rect`, its fit and its motion as given; a moving one where `moving` says so. */
function stateOf(rect: FootageRect, fit: FootageLayerFrameState['fit'] = 'cover', moving = false): FootageLayerFrameState {
  return {
    assetRect: rect,
    fit,
    position: { x: { share: 0.5, offset: 0 }, y: { share: 0.5, offset: 0 } },
    cornerRadius: 0,
    opacity: moving ? 0.3 : 1,
    transform: moving ? { a: 0.5, b: 0, c: 0, d: 0.5, e: -0.4, f: 0 } : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    blur: 0,
    brightness: 1,
    backgroundColor: null,
    fillBlur: 0,
    clipRect: null,
    clipRadius: 0,
    clipInset: { top: 0, right: 0, bottom: 0, left: 0 },
    videoRect: null,
    videoAbove: false,
    videoCornerRadius: 0,
  };
}

/** Each layer laid out by `placements`, resolved where its layout rests it, and drawn where `isDrawn` says. */
function drawnAs(
  placements: Readonly<Record<string, ShotLayerPlacement>>,
  states: Readonly<Record<string, FootageLayerFrameState>> = {},
  isDrawn: (mediaId: string) => boolean = () => true,
): ShotLayersDrawn {
  const restingStateOf = (placement: ShotLayerPlacement) => {
    if (placement.kind === 'inset') return stateOf(BOX_RECT);
    if (placement.kind === 'split') return stateOf({ x: 0, y: 0, width: 1, height: 0.5 });
    return stateOf(WHOLE_FRAME, placement.fit);
  };
  return {
    isDrawn,
    stateOf: (layerId) => states[layerId] ?? (placements[layerId] === undefined ? null : restingStateOf(placements[layerId]!)),
    placementOf: (layerId) => placements[layerId] ?? FULL,
    cssOwnedGesturesOf: () => new Set(),
  };
}

describe('ShotLayerHitTargetResolver', () => {
  it('offers a box over the video where the stage rests it, whatever its motion is doing', () => {
    const moving = { box: stateOf(BOX_RECT, 'cover', true) };

    const { hitTargets } = resolver.resolve([scheduled('box')], 1, VERTICAL, drawnAs({ box: INSET }, moving));

    expect(hitTargets.map((target) => [target.rect, target.placement])).toEqual([[BOX_RECT, INSET]]);
  });

  it('offers a box its camera grew past its layout where its clip keeps it, not where its picture reaches', () => {
    const grown: FootageRect = { x: BOX_RECT.x - 0.2, y: BOX_RECT.y - 0.1, width: BOX_RECT.width * 2, height: BOX_RECT.height * 2 };
    const filmed = { box: { ...stateOf(grown), clipRect: BOX_RECT } };

    const { hitTargets } = resolver.resolve([scheduled('box')], 1, VERTICAL, drawnAs({ box: INSET }, filmed));

    expect(hitTargets.map((target) => target.rect)).toEqual([BOX_RECT]);
  });

  it('offers nothing to press for a full-screen or split layer, though both are on screen', () => {
    const onScreen = resolver.resolve([scheduled('split'), scheduled('full')], 1, VERTICAL, drawnAs({ split: SPLIT, full: FULL }));

    expect(onScreen.hitTargets).toEqual([]);
    expect([...onScreen.visibleLayerIds]).toEqual(['split', 'full']);
  });

  it('lists the boxes bottom to top, so the one drawn last is the one a press lands on', () => {
    const { hitTargets } = resolver.resolve([scheduled('lower'), scheduled('upper')], 1, VERTICAL, drawnAs({ lower: INSET, upper: INSET }));

    expect(hitTargets.map((target) => target.layerId)).toEqual(['lower', 'upper']);
  });

  it('offers no box a full-screen layer is drawn over, even one fading in, and still offers one drawn over it', () => {
    const fadingIn = { full: stateOf(WHOLE_FRAME, 'cover', true) };
    const layers = [scheduled('hidden'), scheduled('full'), scheduled('shown')];

    const { hitTargets } = resolver.resolve(layers, 1, VERTICAL, drawnAs({ hidden: INSET, full: FULL, shown: INSET }, fadingIn));

    expect(hitTargets.map((target) => target.layerId)).toEqual(['shown']);
  });

  it('offers the video\'s box where the video floats over a layer, in the frame\'s shape, and hides what lies beneath', () => {
    const videoFloats: ShotLayerPlacement = { ...INSET, subject: 'video' } as ShotLayerPlacement;
    const floating = { broll: { ...stateOf(WHOLE_FRAME), videoAbove: true, videoRect: BOX_RECT, videoCornerRadius: 0.04 } };
    const layers = [scheduled('hidden'), scheduled('broll')];

    const { hitTargets } = resolver.resolve(layers, 1, VERTICAL, drawnAs({ hidden: INSET, broll: videoFloats }, floating));

    expect(hitTargets.map((target) => [target.layerId, target.rect])).toEqual([['broll', BOX_RECT]]);
    expect(hitTargets[0]!.assetAspectRatio).toBeCloseTo(1080 / 1920, 9);
  });

  it('offers a box only while its stretch holds the instant, its end excluded', () => {
    const layers = [scheduled('early', 0, 2), scheduled('late', 2, 4)];
    const drawn = drawnAs({ early: INSET, late: INSET });

    expect(resolver.resolve(layers, 2, VERTICAL, drawn).hitTargets.map((target) => target.layerId)).toEqual(['late']);
    expect([...resolver.resolve(layers, 4, VERTICAL, drawn).visibleLayerIds]).toEqual([]);
  });

  it('counts a layer whose file is not drawn yet as on screen, with nothing to press', () => {
    const onScreen = resolver.resolve([scheduled('waiting')], 1, VERTICAL, drawnAs({ waiting: INSET }, {}, () => false));

    expect(onScreen.hitTargets).toEqual([]);
    expect([...onScreen.visibleLayerIds]).toEqual(['waiting']);
  });

  it('keeps a box pickable under a full-screen layer the box shows through: a picture, or a fitted video', () => {
    const picture = { ...scheduled('picture'), asset: { kind: 'image' as const, durationSec: null, aspectRatio: 1 } };
    const layers = [scheduled('box'), picture, scheduled('fitted')];

    const { hitTargets } = resolver.resolve(layers, 1, VERTICAL, drawnAs({ box: INSET, picture: FULL, fitted: { kind: 'full', fit: 'contain' } }));

    expect(hitTargets.map((target) => target.layerId)).toEqual(['box']);
  });

  it('does not let an undrawn full-screen layer hide the box beneath it', () => {
    const layers = [scheduled('box'), scheduled('full')];

    const { hitTargets } = resolver.resolve(layers, 1, VERTICAL, drawnAs({ box: INSET, full: FULL }, {}, (mediaId) => mediaId === 'box-file'));

    expect(hitTargets.map((target) => target.layerId)).toEqual(['box']);
  });

  it('offers a picture or a GIF put on a shot, over the b-roll box beneath it, for the whole shot', () => {
    const file = (id: string, type: MediaAssetType) => ({
      id, type, owner: { kind: 'library' as const }, fileName: id, mimeType: '', sizeBytes: 1,
      widthPx: 200, heightPx: 100, durationSec: type === 'video' ? 1 : null,
    });
    const media = MediaAssetCatalog.of([file('clip', 'video'), file('logo', 'image'), file('wave', 'gif')]);
    const layer = (id: string, mediaId: string) => ({ id, mediaId, inSec: 0, outSec: null, loop: false });
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{ id: 'a', startSec: 0, layers: [layer('broll', 'clip'), layer('logo', 'logo'), layer('wave', 'wave')] }],
    });
    const scheduledLayers = new ShotLayerTiming(new ShotLayerAssetReader()).scheduleAll(shots, media, new RenderTimeMap([]), 4);
    const drawn = drawnAs({ broll: INSET, logo: INSET, wave: INSET });

    const whileTheClipPlays = resolver.resolve(scheduledLayers, 0.5, VERTICAL, drawn);
    const afterTheClipEnds = resolver.resolve(scheduledLayers, 3, VERTICAL, drawn);

    expect(whileTheClipPlays.hitTargets.map((target) => target.layerId)).toEqual(['broll', 'logo', 'wave']);
    expect(afterTheClipEnds.hitTargets.map((target) => [target.layerId, target.assetAspectRatio])).toEqual([['logo', 2], ['wave', 2]]);
  });
});
