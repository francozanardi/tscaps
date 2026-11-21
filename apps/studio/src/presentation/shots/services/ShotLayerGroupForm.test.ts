import { describe, expect, it } from 'vitest';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotLayerGroupForm, type ShotLayerGroupMember } from '@presentation/shots/services/ShotLayerGroupForm';

/**
 * Several layers shown through the form one layer is edited through.
 * The promises: the form says where they differ, and a change it hands
 * back becomes only what changed — never the first layer's whole
 * placement.
 */

const form = new ShotLayerGroupForm();

const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: null, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};
const SPLIT: ShotLayerPlacement = { kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0.04, cornerRadius: 0, fit: 'cover' };

function layer(id: string, placement: ShotLayerPlacement, stretch: Partial<ShotLayer> = {}): ShotLayerGroupMember {
  return { layer: { id, mediaId: id, inSec: 0, outSec: null, loop: false, ...stretch }, placement };
}

describe('where the layers differ', () => {
  it('names each setting some layer holds differently from the first', () => {
    const mixed = form.mixedFields([
      layer('a', INSET),
      layer('b', { ...INSET, width: 0.6 }),
      layer('c', { ...INSET, centerY: 0.2 }, { loop: true }),
    ]);

    expect([...mixed].sort()).toEqual(['centerY', 'loop', 'width']);
  });

  it('names the layout where it differs, and the settings both layouts hold that differ', () => {
    const mixed = form.mixedFields([layer('a', INSET), layer('b', { ...SPLIT, fit: 'contain' })]);

    expect([...mixed].sort()).toEqual(['cornerRadius', 'fit', 'layout']);
  });

  it('names nothing for one layer, or for layers alike', () => {
    expect(form.mixedFields([layer('a', INSET)]).size).toBe(0);
    expect(form.mixedFields([layer('a', INSET), layer('b', { ...INSET })]).size).toBe(0);
  });
});

describe('a change read back out of the form', () => {
  it('is only the setting changed', () => {
    expect(form.placementPatch(INSET, { ...INSET, width: 0.7 })).toEqual({ settings: { width: 0.7 } });
  });

  it('is only the layout where the layout changed, not the fresh settings the form filled in', () => {
    expect(form.placementPatch(INSET, SPLIT)).toEqual({ layout: 'split' });
  });

  it('is nothing where nothing changed', () => {
    expect(form.placementPatch(INSET, { ...INSET })).toBeNull();
  });
});
