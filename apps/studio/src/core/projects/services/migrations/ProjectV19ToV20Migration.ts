import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

const LAYOUT_KINDS: readonly unknown[] = ['full', 'split', 'inset'];

// What the v19 partition read a missing or unreadable default as.
const V19_FRESH_DEFAULT: Readonly<Record<string, unknown>> = { kind: 'full', fit: 'cover' };

// Where a v19 picture or GIF was placed when it was added: v19 had no
// picture default, and wrote this into every picture layer instead.
const V19_PICTURE_PLACEMENT: Readonly<Record<string, unknown>> = {
  kind: 'inset',
  centerX: 0.5,
  centerY: 0.3,
  width: 0.5,
  aspectRatio: null,
  padding: 0.04,
  cornerRadius: 0,
  fit: 'contain',
};

/**
 * v19 → v20: every shot layer holds its own placement, and the shots
 * keep one default per layer role instead of one the layers followed.
 *
 * In v19 a layer stored `placement: null` to follow the shots'
 * `defaultPlacement`, which only b-rolls ever did; a stored placement
 * naming no layout was read the same way. Each such layer now carries
 * the default it was drawn with, so nothing on the frame moves. The old
 * default becomes the `video` (b-roll) default, the one a new b-roll
 * starts with. The `picture` default is the placement every picture
 * and GIF was given when added, so a picture added after the upgrade
 * lands where one added before it did.
 *
 * A layer's own placement is carried as stored: the partition clamps
 * every placement as it reads it, as it did in v19.
 */
export class ProjectV19ToV20Migration implements ProjectMigration {
  readonly fromVersion = 19;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(data.shots)) return { ...data };
    return { ...data, shots: this.migratedShots(data.shots) };
  }

  private migratedShots(stored: Record<string, unknown>): Record<string, unknown> {
    const { defaultPlacement, ...rest } = stored;
    const videoDefault = this.isPlacement(defaultPlacement) ? defaultPlacement : V19_FRESH_DEFAULT;
    return {
      ...rest,
      ...(Array.isArray(stored.shots) ? { shots: stored.shots.map((shot) => this.withPlacedLayers(shot, videoDefault)) } : {}),
      defaultPlacements: { video: videoDefault, picture: V19_PICTURE_PLACEMENT },
    };
  }

  private withPlacedLayers(shot: unknown, videoDefault: Readonly<Record<string, unknown>>): unknown {
    if (!this.isRecord(shot) || !Array.isArray(shot.layers)) return shot;
    return { ...shot, layers: shot.layers.map((layer) => this.withPlacement(layer, videoDefault)) };
  }

  private withPlacement(layer: unknown, videoDefault: Readonly<Record<string, unknown>>): unknown {
    if (!this.isRecord(layer) || this.isPlacement(layer.placement)) return layer;
    return { ...layer, placement: videoDefault };
  }

  /** Whether v19 read `value` as a placement of its own rather than as following the default. */
  private isPlacement(value: unknown): value is Record<string, unknown> {
    return this.isRecord(value) && LAYOUT_KINDS.includes(value.kind);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
