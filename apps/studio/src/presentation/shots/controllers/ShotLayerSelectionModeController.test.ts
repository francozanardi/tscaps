import { describe, expect, it } from 'vitest';
import { ShotLayerSelectionModeController } from '@presentation/shots/controllers/ShotLayerSelectionModeController';
import type { SelectableShotLayer } from '@presentation/shots/services/SelectableShotLayerReader';

/**
 * Picking layers in the shots panel, the way the transcript picks
 * scenes: a press toggles one, Shift-press adds a run, and what is
 * picked is always something that is still there.
 */

const broll = (layerId: string, shotNumber: number): SelectableShotLayer => ({ layerId, role: 'video', kind: 'video', shotNumber });
const picture = (layerId: string, shotNumber: number): SelectableShotLayer => ({ layerId, role: 'picture', kind: 'image', shotNumber });

// As the panel shows them: shot by shot, each b-roll before its pictures.
const LAYERS: SelectableShotLayer[] = [
  broll('b1', 1), picture('p1', 1),
  broll('b2', 2),
  broll('b3', 3), picture('p3', 3),
  broll('b4', 4),
];

/** Entered, with `firstPressed` pressed once when given. */
function picking(firstPressed: string | null = null): ShotLayerSelectionModeController {
  const controller = new ShotLayerSelectionModeController();
  controller.enter();
  if (firstPressed !== null) controller.press(firstPressed, false, LAYERS);
  return controller;
}

const picked = (controller: ShotLayerSelectionModeController) => controller.selectedIn(LAYERS).map((layer) => layer.layerId);

describe('entering and leaving', () => {
  it('starts with nothing picked', () => {
    expect(picked(picking())).toEqual([]);
  });

  it('starts over when entered again', () => {
    const controller = picking('b3');

    controller.enter();

    expect(picked(controller)).toEqual([]);
  });

  it('forgets what was picked on leaving', () => {
    const controller = picking('b3');

    controller.exit();

    expect(controller.snapshot()).toEqual({ isActive: false, selectedLayerIds: new Set() });
  });

  it('picks nothing while not entered', () => {
    const controller = new ShotLayerSelectionModeController();

    controller.press('b1', false, LAYERS);
    controller.selectOnly(['b1', 'b2'], LAYERS);

    expect(controller.snapshot().selectedLayerIds.size).toBe(0);
  });
});

describe('a press', () => {
  it('picks a layer, and lets it go when pressed again', () => {
    const controller = picking();

    controller.press('b2', false, LAYERS);
    controller.press('p3', false, LAYERS);
    expect(picked(controller)).toEqual(['b2', 'p3']);

    controller.press('b2', false, LAYERS);
    expect(picked(controller)).toEqual(['p3']);
  });

  it('with Shift adds every layer from the last one pressed, in the panel\'s order, either way along it', () => {
    const controller = picking();

    controller.press('p1', false, LAYERS);
    controller.press('b3', true, LAYERS);
    expect(picked(controller)).toEqual(['p1', 'b2', 'b3']);

    controller.press('b4', false, LAYERS);
    controller.press('p3', true, LAYERS);
    expect(picked(controller)).toEqual(['p1', 'b2', 'b3', 'p3', 'b4']);
  });

  it('with Shift and no earlier press picks that layer alone', () => {
    const controller = picking();

    controller.press('b3', true, LAYERS);

    expect(picked(controller)).toEqual(['b3']);
  });

  it('with Shift runs forward from the last layer pressed', () => {
    const controller = picking('b2');

    controller.press('b4', true, LAYERS);

    expect(picked(controller)).toEqual(['b2', 'b3', 'p3', 'b4']);
  });

  it('on a layer not listed changes nothing', () => {
    const controller = picking('b1');

    controller.press('gone', false, LAYERS);

    expect(picked(controller)).toEqual(['b1']);
  });
});

describe('picking a given set', () => {
  it('picks those layers and nothing else, dropping what was picked', () => {
    const controller = picking('p1');

    controller.selectOnly(['b1', 'b2', 'b3', 'b4'], LAYERS);

    expect(picked(controller)).toEqual(['b1', 'b2', 'b3', 'b4']);
  });

  it('leaves out a layer that cannot be picked', () => {
    const controller = picking();

    controller.selectOnly(['p1', 'gone'], LAYERS);

    expect(picked(controller)).toEqual(['p1']);
  });

  it('clears the selection when given none', () => {
    const controller = picking('b2');

    controller.selectOnly([], LAYERS);

    expect(picked(controller)).toEqual([]);
  });

  it('tells nobody when what is picked is already that set', () => {
    const controller = picking();
    controller.selectOnly(['b1', 'p1'], LAYERS);
    let changes = 0;
    controller.subscribe(() => { changes += 1; });

    controller.selectOnly(['p1', 'b1'], LAYERS);

    expect(changes).toBe(0);
  });

  it('extends a later Shift-press from the last of the set, in the panel order', () => {
    const controller = picking();
    controller.selectOnly(['p3', 'b1'], LAYERS);

    controller.press('b4', true, LAYERS);

    expect(picked(controller)).toEqual(['b1', 'p3', 'b4']);
  });
});

describe('when layers go', () => {
  it('drops the ones no longer listed and keeps the rest', () => {
    const controller = picking();
    controller.selectOnly(['b1', 'b2', 'b3', 'b4'], LAYERS);

    controller.retain(LAYERS.filter((layer) => layer.layerId !== 'b3'));

    expect([...controller.snapshot().selectedLayerIds]).toEqual(['b1', 'b2', 'b4']);
  });

  it('tells nobody when nothing it holds went', () => {
    const controller = picking('b1');
    let changes = 0;
    controller.subscribe(() => { changes += 1; });

    controller.retain(LAYERS);

    expect(changes).toBe(0);
  });

  it('forgets a range start that went, so a Shift-press after it picks one layer', () => {
    const controller = picking('b1');
    const without = LAYERS.filter((layer) => layer.layerId !== 'b1');

    controller.retain(without);
    controller.press('b3', true, without);

    expect(controller.selectedIn(without).map((layer) => layer.layerId)).toEqual(['b3']);
  });
});
