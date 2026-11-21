import { describe, expect, it } from 'vitest';
import { ProjectV19ToV20Migration } from '@core/projects/services/migrations/ProjectV19ToV20Migration';
import { ProjectV20ToV21Migration } from '@core/projects/services/migrations/ProjectV20ToV21Migration';

/**
 * Shot layers that followed a video-wide default, on projects written
 * before every layer held its own placement.
 *
 * The promise is that nothing on the frame moves: a layer that followed
 * the default is drawn after the upgrade exactly where it was drawn
 * before, and a file added after the upgrade lands where one of its
 * kind landed before.
 */

const migration = new ProjectV19ToV20Migration();

const SPLIT = { kind: 'split', assetSide: 'end', assetRatio: 0.4, padding: 0, cornerRadius: 0.05, fit: 'contain' };
const INSET = { kind: 'inset', centerX: 0.8, centerY: 0.2, width: 0.3, aspectRatio: 1, padding: 0.02, cornerRadius: 0.1, fit: 'cover' };
const V19_PICTURE = { kind: 'inset', centerX: 0.5, centerY: 0.3, width: 0.5, aspectRatio: null, padding: 0.04, cornerRadius: 0, fit: 'contain' };

function layer(id: string, placement: unknown): Record<string, unknown> {
  return { id, mediaId: `${id}-file`, inSec: 0, outSec: null, loop: false, placement };
}

function v19Shots(layers: Record<string, unknown>[], defaultPlacement?: unknown): Record<string, unknown> {
  return {
    maxShotSec: 6,
    shots: [{ id: 'a', startSec: 0, layers }, { id: 'b', startSec: 4 }],
    ...(defaultPlacement === undefined ? {} : { defaultPlacement }),
  };
}

/** The shots as the migrated payload holds them, through the step after this one: what v21 read. */
interface StoredShots {
  readonly shots: ReadonlyArray<{ readonly layers?: ReadonlyArray<Record<string, unknown>> }>;
  readonly lastEditedPlacements?: Readonly<Record<string, unknown>>;
}

/**
 * The migrated shots, read as stored rather than through the partition,
 * which has moved on since: the steps after these are what take them
 * further.
 */
function migratedPartition(shots: Record<string, unknown>): { placementForNewLayer(role: string): unknown; stored: StoredShots } {
  const migrated = new ProjectV20ToV21Migration().migrate(migration.migrate({ version: 19, shots }));
  const stored = migrated.shots as StoredShots;
  return { stored, placementForNewLayer: (role) => stored.lastEditedPlacements?.[role] };
}

function placementOf(partition: { stored: StoredShots }, layerId: string): unknown {
  return partition.stored.shots.flatMap((shot) => shot.layers ?? []).find((held) => held['id'] === layerId)?.['placement'];
}

describe('a layer that followed the default', () => {
  it('holds the default it was drawn with', () => {
    const partition = migratedPartition(v19Shots([layer('broll', null)], SPLIT));
    expect(placementOf(partition, 'broll')).toEqual(SPLIT);
  });

  it('is stored with that placement, not left for a reader to resolve', () => {
    const migrated = migration.migrate({ version: 19, shots: v19Shots([layer('broll', null)], SPLIT) });
    const shots = (migrated.shots as { shots: { layers?: Record<string, unknown>[] }[] }).shots;
    expect(shots[0]!.layers![0]!.placement).toEqual(SPLIT);
  });

  it('holds full screen where the default was never changed', () => {
    const partition = migratedPartition(v19Shots([layer('broll', null)]));
    expect(placementOf(partition, 'broll')).toEqual({ kind: 'full', fit: 'cover' });
  });

  it('holds the default where its stored placement named no layout, as v19 read it', () => {
    const partition = migratedPartition(v19Shots([layer('broll', { kind: 'nothing' })], SPLIT));
    expect(placementOf(partition, 'broll')).toEqual(SPLIT);
  });

  it('holds full screen where the stored default itself named no layout', () => {
    const partition = migratedPartition(v19Shots([layer('broll', null)], { kind: 'nothing' }));
    expect(placementOf(partition, 'broll')).toEqual({ kind: 'full', fit: 'cover' });
  });
});

describe('a layer with its own placement', () => {
  it('keeps it, whatever the default was', () => {
    const partition = migratedPartition(v19Shots([layer('own', INSET), layer('follows', null)], SPLIT));
    expect(placementOf(partition, 'own')).toEqual(INSET);
    expect(placementOf(partition, 'follows')).toEqual(SPLIT);
  });
});

describe('the defaults a new layer starts with', () => {
  it('give a new b-roll the old default', () => {
    expect(migratedPartition(v19Shots([], SPLIT)).placementForNewLayer('video')).toEqual(SPLIT);
  });

  it('give a new picture the placement a picture was added with before', () => {
    expect(migratedPartition(v19Shots([], SPLIT)).placementForNewLayer('picture')).toEqual(V19_PICTURE);
  });

  it('leave the old field behind', () => {
    const migrated = migration.migrate({ version: 19, shots: v19Shots([], SPLIT) });
    expect(migrated.shots).not.toHaveProperty('defaultPlacement');
  });
});

describe('a project with no shots stored', () => {
  it('is left as it is', () => {
    const data = { version: 19, name: 'Beach reel' };
    expect(migration.migrate(data)).toEqual(data);
  });

  it('still reads as untouched shots: no shot, and the placements a new layer starts with left as they were', () => {
    const { stored } = migratedPartition({ maxShotSec: 6, shots: [] });

    expect(stored.shots).toEqual([]);
    expect(stored.lastEditedPlacements).toEqual({ video: { kind: 'full', fit: 'cover' }, picture: V19_PICTURE });
  });

});
