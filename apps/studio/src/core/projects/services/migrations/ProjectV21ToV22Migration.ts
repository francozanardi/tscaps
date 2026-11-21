import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

// What v21 read a duration it could not use as, and the range it clamped one to.
const V21_FRESH_DURATION_SEC = 0.4;
const V21_DURATION_RANGE = { min: 0.1, max: 2 } as const;

// A v21 entrance slid in *from* its side, so it travelled away from it.
const ENTRANCE_DIRECTION_BY_SIDE: ReadonlyMap<unknown, string> = new Map([['left', 'right'], ['right', 'left'], ['top', 'down'], ['bottom', 'up']]);
// A v21 exit slid out *by* its side, so it travelled towards it.
const EXIT_DIRECTION_BY_SIDE: ReadonlyMap<unknown, string> = new Map([['left', 'left'], ['right', 'right'], ['top', 'up'], ['bottom', 'down']]);
// The side v21 gave a slide whose own could not be read: in from the left, out by the right.
const V21_FRESH_SIDE: Readonly<Record<Edge, string>> = { entrance: 'left', exit: 'right' };

type Edge = 'entrance' | 'exit';

/**
 * v21 → v22: a shot layer's entrance and exit name a motion preset and
 * its fields, instead of a fixed kind.
 *
 * In v21 each edge held `{ kind, durationSec }`, plus `side` for a
 * slide: `none`, `fade`, `pop` or `slide`. Each becomes `null` (no
 * motion) or `{ presetId, params }`: `fade` and `pop` keep their names
 * and duration, and a slide keeps its duration and turns its side into
 * the way it travels — an entrance from the left travels right, an exit
 * by the right travels right. A kind v21 did not know, or no motion at
 * all, is `null`, as v21 read it. Durations are clamped the way v21
 * read them.
 */
export class ProjectV21ToV22Migration implements ProjectMigration {
  readonly fromVersion = 21;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(data.shots) || !Array.isArray(data.shots.shots)) return { ...data };
    return { ...data, shots: { ...data.shots, shots: data.shots.shots.map((shot) => this.migratedShot(shot)) } };
  }

  private migratedShot(shot: unknown): unknown {
    if (!this.isRecord(shot) || !Array.isArray(shot.layers)) return shot;
    return { ...shot, layers: shot.layers.map((layer) => this.migratedLayer(layer)) };
  }

  private migratedLayer(layer: unknown): unknown {
    if (!this.isRecord(layer)) return layer;
    return { ...layer, entrance: this.migratedMotion(layer.entrance, 'entrance'), exit: this.migratedMotion(layer.exit, 'exit') };
  }

  private migratedMotion(motion: unknown, edge: Edge): Record<string, unknown> | null {
    if (!this.isRecord(motion)) return null;
    const duration = this.durationOf(motion.durationSec);
    switch (motion.kind) {
      case 'fade':
      case 'pop':
        return { presetId: motion.kind, params: { duration } };
      case 'slide':
        return { presetId: 'slide', params: { duration, direction: this.directionOf(motion.side, edge) } };
      default:
        return null;
    }
  }

  private directionOf(side: unknown, edge: Edge): string {
    const directions = edge === 'entrance' ? ENTRANCE_DIRECTION_BY_SIDE : EXIT_DIRECTION_BY_SIDE;
    return directions.get(side) ?? directions.get(V21_FRESH_SIDE[edge])!;
  }

  private durationOf(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return V21_FRESH_DURATION_SEC;
    return Math.min(V21_DURATION_RANGE.max, Math.max(V21_DURATION_RANGE.min, value));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
