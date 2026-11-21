import { describe, expect, it } from 'vitest';
import { ProjectV20ToV21Migration } from '@core/projects/services/migrations/ProjectV20ToV21Migration';

/**
 * Projects written while a new shot layer took its role's default, set
 * by *Apply to all*. The promise is that nothing changes for the user:
 * every layer stays where it is, and a layer added after the upgrade
 * starts where one added before it would have.
 */

const migration = new ProjectV20ToV21Migration();

const SPLIT = { kind: 'split', assetSide: 'end', assetRatio: 0.4, padding: 0, cornerRadius: 0.05, fit: 'contain' };
const INSET = { kind: 'inset', centerX: 0.8, centerY: 0.2, width: 0.3, aspectRatio: 1, padding: 0.02, cornerRadius: 0.1, fit: 'cover' };
// What v21 started a layer of each role with while none of that role had been edited.
const V21_FRESH: Readonly<Record<string, unknown>> = {
  video: { kind: 'full', fit: 'cover' },
  picture: { kind: 'inset', centerX: 0.5, centerY: 0.3, width: 0.5, aspectRatio: null, padding: 0.04, cornerRadius: 0, fit: 'contain' },
};

function v20Shots(defaultPlacements?: unknown): Record<string, unknown> {
  return {
    maxShotSec: 6,
    shots: [{ id: 'a', startSec: 0, layers: [{ id: 'own', mediaId: 'clip', inSec: 0, outSec: null, loop: false, placement: INSET }] }],
    ...(defaultPlacements === undefined ? {} : { defaultPlacements }),
  };
}

interface StoredShots {
  readonly shots: ReadonlyArray<{ readonly layers?: ReadonlyArray<Record<string, unknown>> }>;
  readonly lastEditedPlacements?: Readonly<Record<string, unknown>>;
}

/**
 * The migrated shots as v21 read them, off the payload as stored rather
 * than through the partition, which has moved on since: the steps after
 * this one are what take them further.
 */
function migratedPartition(shots: Record<string, unknown>): {
  placementForNewLayer(role: string): unknown;
  findLayer(id: string): Record<string, unknown> | undefined;
} {
  const stored = migration.migrate({ version: 20, shots }).shots as StoredShots;
  return {
    placementForNewLayer: (role) => stored.lastEditedPlacements?.[role] ?? V21_FRESH[role],
    findLayer: (id) => stored.shots.flatMap((shot) => shot.layers ?? []).find((held) => held['id'] === id),
  };
}

describe('the placement a new layer starts with', () => {
  it('is the one a new layer of each role took before the upgrade', () => {
    const partition = migratedPartition(v20Shots({ video: SPLIT, picture: INSET }));

    expect(partition.placementForNewLayer('video')).toEqual(SPLIT);
    expect(partition.placementForNewLayer('picture')).toEqual(INSET);
  });

  it('is the fresh one for a role that was never applied to', () => {
    const partition = migratedPartition(v20Shots({ video: SPLIT }));

    expect(partition.placementForNewLayer('picture')).toEqual(V21_FRESH['picture']);
  });

  it('is the fresh one for both roles where nothing was ever applied', () => {
    const partition = migratedPartition(v20Shots());

    expect(partition.placementForNewLayer('video')).toEqual({ kind: 'full', fit: 'cover' });
    expect(partition.placementForNewLayer('picture')).toEqual(V21_FRESH['picture']);
  });

  it('leaves the old field behind', () => {
    const migrated = migration.migrate({ version: 20, shots: v20Shots({ video: SPLIT }) });

    expect(migrated.shots).not.toHaveProperty('defaultPlacements');
  });
});

describe('the layers', () => {
  it('stay where they were', () => {
    expect(migratedPartition(v20Shots({ video: SPLIT })).findLayer('own')?.['placement']).toEqual(INSET);

  });
});

describe('a project with no shots stored', () => {
  it('is carried as it is', () => {
    expect(migration.migrate({ version: 20, title: 'x' })).toEqual({ version: 20, title: 'x' });
  });
});
