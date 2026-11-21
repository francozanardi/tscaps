import { describe, expect, it } from 'vitest';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ProjectV23ToV24Migration } from '@core/projects/services/migrations/ProjectV23ToV24Migration';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';

/**
 * Shot layers placed by a placement the editor turned into rects, on
 * projects saved before a layer's layout was CSS.
 *
 * The promise is that every layer sits where it sat: the same layout
 * with the same settings, now held as the layer's fields and written
 * into its CSS — the text the editor writes for that layout, after the
 * motion it already held — and that a new layer still starts where the
 * last edited one of its kind was left.
 */

const layouts = new TestShotLayerLayouts();
const migration = new ProjectV23ToV24Migration(layouts.catalog, layouts.controls);

const FULL: ShotLayerPlacement = { kind: 'full', fit: 'contain' };
const SPLIT: ShotLayerPlacement = { kind: 'split', assetSide: 'end', assetRatio: 0.4, padding: 0.05, cornerRadius: 0.1, fit: 'cover' };
const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.25, centerY: 0.7, width: 0.35, aspectRatio: null, padding: 0.03, cornerRadius: 0.02, fit: 'contain',
};
const SHAPED_INSET: ShotLayerPlacement = { ...INSET, aspectRatio: 0.8 };

function layer(id: string, placement: unknown): Record<string, unknown> {
  return { id, mediaId: `${id}-file`, inSec: 0, outSec: null, loop: false, placement };
}

function migrated(shots: Record<string, unknown>): Record<string, unknown> {
  return migration.migrate({ version: 23, shots: { maxShotSec: 6, ...shots } });
}

/** The partition the migrated payload reads as, which is what the editor, the preview and the export draw. */
function migratedPartition(shots: Record<string, unknown>): ShotPartition {
  return ShotPartition.fromSnapshot(migrated(shots).shots as unknown as ShotsSnapshot);
}

const oneShot = (layers: ReadonlyArray<Record<string, unknown>>) => ({ shots: [{ id: 'a', startSec: 0, layers }] });

describe('ProjectV23ToV24Migration', () => {
  it('keeps each layer\'s layout and its settings, as the layer\'s fields', () => {
    const placements = { full: FULL, split: SPLIT, inset: INSET, shaped: SHAPED_INSET };
    const partition = migratedPartition(oneShot(Object.entries(placements).map(([id, placement]) => layer(id, placement))));

    for (const [id, placement] of Object.entries(placements)) expect(partition.placementOf(id)).toEqual(placement);
  });

  it('writes the layout into the layer\'s CSS as the editor would have, after the motion it held', () => {
    const motion = { kind: 'layer', animations: { [ElementAnimationScope.ENTRANCE]: { presetId: 'layer-fade-entrance', params: {} } }, css: '--layer-entrance-animation: fade 1s;' };
    const partition = migratedPartition({ ...oneShot([layer('clip', SPLIT)]), layerStyles: { clip: motion } });
    const editorWritten = layouts.writer.written(ElementStyles.fromSnapshot({ clip: motion } as never), 'clip', SPLIT).get('clip')!;

    expect(partition.layerStyles.get('clip')).toEqual(editorWritten);
    expect(partition.layerStyles.get('clip')!.css.startsWith(motion.css)).toBe(true);
  });

  it('drops the placement off the stored layer', () => {
    const payload = migrated(oneShot([layer('clip', INSET)]));
    const [stored] = (payload.shots as { shots: Array<{ layers: Array<Record<string, unknown>> }> }).shots[0]!.layers;

    expect(stored).not.toHaveProperty('placement');
  });

  it('writes nothing for a placement naming no layout, which drew on the full frame', () => {
    const partition = migratedPartition(oneShot([layer('lost', { kind: 'diagonal' }), layer('none', undefined)]));

    expect(partition.layerStyles.has('lost')).toBe(false);
    expect(partition.layerStyles.has('none')).toBe(false);
    expect(partition.placementOf('lost')).toEqual({ kind: 'full', fit: 'cover' });
  });

  it('reads a setting v23 could not read as its layout\'s fresh one, and clamps one out of range, as v23 drew them', () => {
    const partition = migratedPartition(oneShot([layer('clip', { kind: 'inset', subject: 'asset', centerX: 'left', width: 3, padding: -1, fit: 'stretch' })]));

    expect(partition.placementOf('clip')).toEqual({
      kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 1, aspectRatio: null, padding: 0, cornerRadius: 0.04, fit: 'cover',
    });
  });

  it('remembers the layout each kind of layer was last edited to, so a new one starts there', () => {
    const partition = migratedPartition({ ...oneShot([]), lastEditedPlacements: { video: SPLIT, picture: SHAPED_INSET } });

    expect(partition.placementForNewLayer('video')).toEqual(SPLIT);
    expect(partition.placementForNewLayer('picture')).toEqual(SHAPED_INSET);
    expect(migrated({ ...oneShot([]), lastEditedPlacements: { video: SPLIT } }).shots).not.toHaveProperty('lastEditedPlacements');
  });
});
