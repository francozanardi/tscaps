import { describe, expect, it } from 'vitest';
import { ShotLayerSelectMenu, type ShotLayerSelectOption, type ShotLayerSelectOptionId } from '@presentation/shots/services/ShotLayerSelectMenu';
import type { SelectableShotLayer } from '@presentation/shots/services/SelectableShotLayerReader';

/**
 * The *Select* screen of the layer selection: what each entry picks, which
 * one already matches what is picked, and which cannot be chosen.
 */

const broll = (layerId: string, shotNumber: number): SelectableShotLayer => ({ layerId, role: 'video', kind: 'video', shotNumber });
const picture = (layerId: string, shotNumber: number): SelectableShotLayer => ({ layerId, role: 'picture', kind: 'image', shotNumber });
const gif = (layerId: string, shotNumber: number): SelectableShotLayer => ({ layerId, role: 'picture', kind: 'gif', shotNumber });

// As the panel shows them: shot by shot, each b-roll before its pictures.
const LAYERS: SelectableShotLayer[] = [
  broll('b1', 1), picture('p1', 1),
  broll('b2', 2),
  broll('b3', 3), gif('g3', 3),
];

function option(
  id: ShotLayerSelectOptionId,
  selected: ReadonlyArray<string> = [],
  selectable: ReadonlyArray<SelectableShotLayer> = LAYERS,
): ShotLayerSelectOption {
  const found = new ShotLayerSelectMenu().optionsFor(selectable, new Set(selected)).find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no ${id} entry`);
  return found;
}

describe('what each entry picks', () => {
  it('lists every entry, in the order the screen shows them', () => {
    const ids = new ShotLayerSelectMenu().optionsFor(LAYERS, new Set()).map((entry) => entry.id);

    expect(ids).toEqual(['all', 'brolls', 'pictures', 'none']);
  });

  it('picks every layer for All layers, in the panel order', () => {
    expect(option('all').layerIds).toEqual(['b1', 'p1', 'b2', 'b3', 'g3']);
  });

  it('picks only the b-rolls for All b-rolls', () => {
    expect(option('brolls').layerIds).toEqual(['b1', 'b2', 'b3']);
  });

  it('picks pictures and GIFs together for All pictures and GIFs', () => {
    expect(option('pictures').layerIds).toEqual(['p1', 'g3']);
  });

  it('picks nothing for Clear selection', () => {
    expect(option('none', ['b1']).layerIds).toEqual([]);
  });
});

describe('an entry already applied', () => {
  it('reads as applied when what is picked is exactly its layers', () => {
    expect(option('brolls', ['b3', 'b1', 'b2']).isApplied).toBe(true);
  });

  it('does not read as applied when one of its layers is missing', () => {
    expect(option('brolls', ['b1', 'b2']).isApplied).toBe(false);
  });

  it('does not read as applied when something else is picked too', () => {
    expect(option('brolls', ['b1', 'b2', 'b3', 'p1']).isApplied).toBe(false);
  });

  it('marks both All layers and the one kind when the project holds only that kind', () => {
    const onlyBrolls = [broll('b1', 1), broll('b2', 2)];

    expect(option('all', ['b1', 'b2'], onlyBrolls).isApplied).toBe(true);
    expect(option('brolls', ['b1', 'b2'], onlyBrolls).isApplied).toBe(true);
  });

  it('never marks Clear selection, even with nothing picked', () => {
    expect(option('none', []).isApplied).toBe(false);
  });
});

describe('an entry that cannot be chosen', () => {
  it('disables a kind no shot holds, and does not mark it as applied', () => {
    const onlyBrolls = [broll('b1', 1)];

    expect(option('pictures', [], onlyBrolls)).toMatchObject({ isAvailable: false, isApplied: false });
  });

  it('disables every set entry when nothing can be picked', () => {
    const entries = new ShotLayerSelectMenu().optionsFor([], new Set());

    expect(entries.filter((entry) => entry.isAvailable).map((entry) => entry.id)).toEqual([]);
  });

  it('disables Clear selection while nothing is picked', () => {
    expect(option('none', []).isAvailable).toBe(false);
  });

  it('offers Clear selection once something is picked', () => {
    expect(option('none', ['p1']).isAvailable).toBe(true);
  });
});
