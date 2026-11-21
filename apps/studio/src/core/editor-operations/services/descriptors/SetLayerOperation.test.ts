import type { GraphicCheckFrame } from '@core/graphics/domain/GraphicCheckReport';
import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { describe, expect, it } from 'vitest';
import { ElementStyleReadout } from '@core/editor-operations/services/ElementStyleReadout';
import { GraphicReadout } from '@core/editor-operations/services/GraphicReadout';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { ShotLayerReadout, type ShotLayerPlacementReadout } from '@core/editor-operations/services/ShotLayerReadout';
import { SetLayerOperation } from '@core/editor-operations/services/descriptors/SetLayerOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

function operationOn(fixture: ShotOperationsFixture): SetLayerOperation {
  return new SetLayerOperation(fixture.store, fixture.shotRefs, fixture.media, fixture.actions.patchLayers, fixture.layerPatcher, fixture.layerRuns, fixture.graphicFill, fixture.layerTransitions);
}

/** The placement of the layer `layerId` as get_element reads it. */
function readBack(fixture: ShotOperationsFixture, layerId: string): ShotLayerPlacementReadout {
  const format = new ReadoutFormatter();
  const readout = new ShotLayerReadout(
    fixture.media,
    new ShotLayerAssetReader(),
    new GraphicReadout(new BuiltinGraphicPresetCatalog(), new GraphicMessageLog(), format),
    new ElementStyleReadout(format),
    new ShotLayerSplitTransitions(),
    new ShotLayerInsetTransitions(),
    fixture.parser,
    format,
  );
  const resolved = fixture.shotRefs.resolveLayer(`layer:${layerId}`);
  if (!resolved.ok) throw new Error(`No layer ${layerId}.`);
  return readout.detail(resolved.value, fixture.store.snapshot()).placement;
}

/** A picture a graphic drew `sec` after it appears, `share` of it painted solid. */
function painted(sec: number, share: number): GraphicCheckFrame {
  return { sec, bitmap: null, drawnShare: share, paintedShare: share, error: null, text: null };
}

/** The id of the layer showing `mediaId`, placed on the second shot. */
async function placed(fixture: ShotOperationsFixture, mediaId: string): Promise<string> {
  await fixture.actions.showFile.execute(fixture.shot(1).shot.id, mediaId, 'assistant');
  return fixture.shot(1).shot.layers.find((layer) => 'mediaId' in layer && layer.mediaId === mediaId)!.id;
}

describe('set_layer', () => {
  it('has a layer show through a later shot, and back on its own shot alone', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const layerId = await placed(fixture, 'pic');
    const shownOn = () => fixture.store.snapshot().shots.runOf(layerId).map((shot) => shot.id);

    const longer = await operationOn(fixture).run({ layer: `layer:${layerId}`, through: fixture.shot(3).ref });

    expect(longer.output).toMatchObject({ through: fixture.shot(3).ref, shots: 3 });
    expect(shownOn()).toEqual([1, 2, 3].map((index) => fixture.shot(index).shot.id));

    const back = await operationOn(fixture).run({ layer: `layer:${layerId}`, through: fixture.shot(1).ref });

    expect(back.output).toMatchObject({ through: fixture.shot(1).ref, shots: 1 });
    expect(shownOn()).toEqual([fixture.shot(1).shot.id]);
  });

  it('moves a layer to open on another shot, the same layer, keeping how far it shows where it can', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const layerId = await placed(fixture, 'pic');
    await operationOn(fixture).run({ layer: `layer:${layerId}`, through: fixture.shot(2).ref });
    const shownOn = () => fixture.store.snapshot().shots.runOf(layerId).map((shot) => shot.id);

    const earlier = await operationOn(fixture).run({ layer: `layer:${layerId}`, shot: fixture.shot(0).ref });

    expect(earlier.output).toMatchObject({ shot: fixture.shot(0).ref, through: fixture.shot(2).ref, shots: 3 });
    expect(shownOn()).toEqual([0, 1, 2].map((index) => fixture.shot(index).shot.id));

    const later = await operationOn(fixture).run({ layer: `layer:${layerId}`, shot: fixture.shot(3).ref });

    expect(later.output).toMatchObject({ shot: fixture.shot(3).ref, through: fixture.shot(3).ref, shots: 1 });
    expect(shownOn()).toEqual([fixture.shot(3).shot.id]);

    const backwards = await operationOn(fixture).run({ layer: `layer:${layerId}`, shot: fixture.shot(2).ref, through: fixture.shot(1).ref });

    expect(backwards.ok).toBe(false);
    expect(shownOn()).toEqual([fixture.shot(3).shot.id]);
  });

  it('refuses a shot before the one the layer opens on, changing nothing', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const layerId = await placed(fixture, 'pic');
    const before = fixture.store.snapshot().shots;

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'full' }, through: fixture.shot(0).ref });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('comes before');
    expect(fixture.store.snapshot().shots).toBe(before);
  });

  it('changes only the settings given, the layer keeping its others', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const layerId = await placed(fixture, 'pic');
    const before = fixture.store.snapshot().shots.placementOf(layerId);

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'inset', width: 0.3 } });

    expect(result.ok).toBe(true);
    expect(fixture.store.snapshot().shots.placementOf(layerId)).toEqual({ ...before, width: 0.3 });
  });

  it('switches a layer to another layout from that layout\'s defaults', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('clip', 'video');
    const layerId = await placed(fixture, 'clip');

    await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'split', assetSide: 'end' } });

    expect(fixture.store.snapshot().shots.placementOf(layerId)).toMatchObject({ kind: 'split', assetSide: 'end', assetRatio: 0.5 });
  });

  it('sets how a split plays at the layer\'s ends, with its sound, read back under the same names', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('clip', 'video');
    const layerId = await placed(fixture, 'clip');
    const entrance = { kind: 'reveal', durationSec: 0.8 } as const;

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'split', entrance, exit: { kind: 'cut' } } });

    expect(result).toMatchObject({ ok: true, problems: [] });
    expect(readBack(fixture, layerId)).toMatchObject({ kind: 'split', entrance, exit: { kind: 'cut' } });
    const sounds = new LayerTransitionSoundSuggestions();
    const audio = fixture.store.snapshot().audio;
    expect([sounds.clipsOn(audio, layerId, 'entrance').length, sounds.clipsOn(audio, layerId, 'exit').length]).toEqual([1, 0]);
  });

  it('changes only the part of a box\'s transition given, the rest kept', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const layerId = await placed(fixture, 'pic');
    await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'inset', exit: { kind: 'full' } } });

    await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'inset', exit: { durationSec: 1.2 } } });

    expect(readBack(fixture, layerId)).toMatchObject({ kind: 'inset', entrance: { kind: 'cut' }, exit: { kind: 'full', durationSec: 1.2 } });
  });

  it('picks the part of a video that plays, kept inside the file, and says where it was moved', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('clip', 'video', 5);
    const layerId = await placed(fixture, 'clip');

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, timing: { inSec: 1.5, outSec: 9, loop: true } });

    const layer = fixture.store.snapshot().shots.findLayer(layerId) as ShotFileLayer;
    expect([layer.inSec, layer.outSec, layer.loop]).toEqual([1.5, null, true]);
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning' })]);
  });

  it('moves and resizes a graphic\'s box, keeping its own shape', async () => {
    const fixture = new ShotOperationsFixture();
    const layerId = fixture.actions.addGraphic.execute(fixture.shot(1).shot.id, fixture.graphicPresets.starter())!;

    await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'inset', centerY: 0.2, width: 0.6 } });

    expect(fixture.store.snapshot().shots.placementOf(layerId)).toMatchObject({ kind: 'inset', centerY: 0.2, width: 0.6, aspectRatio: null, cornerRadius: 0 });
  });

  it('refuses a timing for a picture and a fit for a graphic, changing nothing', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const pictureId = await placed(fixture, 'pic');
    const graphicId = fixture.actions.addGraphic.execute(fixture.shot(1).shot.id, fixture.graphicPresets.starter())!;
    const before = fixture.store.snapshot();

    const timed = await operationOn(fixture).run({ layer: `layer:${pictureId}`, timing: { inSec: 1 } });
    const fitted = await operationOn(fixture).run({ layer: `layer:${graphicId}`, layout: { kind: 'full', fit: 'contain' } });

    expect([timed.ok, fitted.ok]).toEqual([false, false]);
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('refuses the whole frame or a split to a graphic that leaves most of it see-through, changing nothing', async () => {
    const fixture = new ShotOperationsFixture();
    const graphicId = fixture.actions.addGraphic.execute(fixture.shot(1).shot.id, fixture.graphicPresets.starter())!;
    fixture.graphicChecker.answer({ frames: [painted(0.4, 0.15), painted(1.2, 0.2)] });
    const before = fixture.store.snapshot();

    const full = await operationOn(fixture).run({ layer: `layer:${graphicId}`, layout: { kind: 'full' } });
    const split = await operationOn(fixture).run({ layer: `layer:${graphicId}`, layout: { kind: 'split' } });

    expect([full.ok, split.ok]).toEqual([false, false]);
    expect(full.problems[0]?.message).toContain('20%');
    expect(full.problems[0]?.message).toContain('inset');
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('lays a graphic that paints the whole of its part out over the frame or split with the video, as a b-roll', async () => {
    const fixture = new ShotOperationsFixture();
    const graphicId = fixture.actions.addGraphic.execute(fixture.shot(1).shot.id, fixture.graphicPresets.starter())!;
    // A scene that comes in from nothing is judged where it paints most.
    fixture.graphicChecker.answer({ frames: [painted(0.4, 0), painted(1.2, 1)] });

    const full = await operationOn(fixture).run({ layer: `layer:${graphicId}`, layout: { kind: 'full' } });

    expect(full.ok).toBe(true);
    expect(fixture.store.snapshot().shots.placementOf(graphicId).kind).toBe('full');

    const split = await operationOn(fixture).run({ layer: `layer:${graphicId}`, layout: { kind: 'split', assetSide: 'start' } });

    expect(split.ok).toBe(true);
    expect(fixture.store.snapshot().shots.placementOf(graphicId)).toMatchObject({ kind: 'split', assetSide: 'start' });
  });

  it('lets a graphic drawn for the whole frame keep it', async () => {
    const fixture = new ShotOperationsFixture();
    const wholeFrame = { ...fixture.graphicPresets.starter(), box: { kind: 'full' as const } };
    const graphicId = fixture.actions.addGraphic.execute(fixture.shot(1).shot.id, wholeFrame)!;

    const result = await operationOn(fixture).run({ layer: `layer:${graphicId}`, layout: { kind: 'full' } });

    expect(result.ok).toBe(true);
    expect(fixture.store.snapshot().shots.placementOf(graphicId).kind).toBe('full');
  });

  it('refuses a setting out of its range', async () => {
    const fixture = new ShotOperationsFixture();

    const result = await operationOn(fixture).run({ layer: 'layer:any', layout: { kind: 'split', assetRatio: 0.9 } });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('layout.assetRatio');
  });

  it('refuses a transition of the other layout, or longer than the editor allows', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const layerId = await placed(fixture, 'pic');
    const before = fixture.store.snapshot();

    const slid = await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'inset', entrance: { kind: 'slide' } } });
    const long = await operationOn(fixture).run({ layer: `layer:${layerId}`, layout: { kind: 'split', exit: { durationSec: 5 } } });

    expect([slid.ok, long.ok]).toEqual([false, false]);
    expect(slid.problems[0]?.message).toContain('layout.entrance');
    expect(long.problems[0]?.message).toContain('layout.exit');
    expect(fixture.store.snapshot()).toBe(before);
  });
});
