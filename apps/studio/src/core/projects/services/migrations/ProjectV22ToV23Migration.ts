import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

type Edge = 'entrance' | 'exit';

// The presets v22 offered, each the same motion the library now holds at both ends.
const V22_PRESETS: ReadonlySet<string> = new Set(['fade', 'pop', 'slide', 'push', 'zoom-out', 'blur', 'wipe', 'spin']);

// A v22 direction was the way a layer travels; now it is the angle it travels at.
const ANGLE_BY_DIRECTION: ReadonlyMap<unknown, string> = new Map([
  ['right', '0deg'],
  ['down', '90deg'],
  ['left', '180deg'],
  ['up', '270deg'],
]);

// v22 read an intensity or a distance as a percentage from 10 to 100; now it is the same share as a fraction.
const PERCENT_FIELDS: ReadonlySet<string> = new Set(['intensity', 'distance']);
const NUMBER_RANGES: Readonly<Record<string, { readonly min: number; readonly max: number }>> = {
  duration: { min: 0.1, max: 2 },
  intensity: { min: 0.1, max: 1 },
  distance: { min: 0.1, max: 1 },
  angle: { min: 45, max: 360 },
};

const SCOPE_BY_EDGE: Readonly<Record<Edge, ElementAnimationScope>> = {
  entrance: ElementAnimationScope.ENTRANCE,
  exit: ElementAnimationScope.EXIT,
};

/**
 * v22 → v23: a shot layer's entrance and exit become CSS, held as the
 * layer's element style.
 *
 * In v22 each layer held `entrance` and `exit`, each `{ presetId,
 * params }` or `null`, read by the engine as keyframes. Each becomes an
 * animation of the layer's style under `shots.layerStyles[layerId]`
 * (kind `layer`), at the scope of its edge, with the block it writes
 * into the layer's CSS: preset `slide` at the entrance is
 * `layer-slide-entrance`. Fields carry over with their values: a
 * duration as it was, a direction as the angle it travels at (`right`
 * is `0deg`), an intensity or a distance from a percentage to a
 * fraction, an angle as it was. A preset v22 did not offer, a field it
 * did not hold, or no motion at all writes nothing, as v22 read them.
 *
 * The writer is borrowed from production, as `ProjectV15ToV16Migration`
 * borrows it: spelled out by hand, the block would be text the editor
 * does not recognise as its own.
 */
export class ProjectV22ToV23Migration implements ProjectMigration {
  readonly fromVersion = 22;

  constructor(private readonly animationCssWriter: ElementAnimationCssWriter) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(data.shots) || !Array.isArray(data.shots.shots)) return { ...data };
    const styles: Record<string, unknown> = this.isRecord(data.shots.layerStyles) ? { ...data.shots.layerStyles } : {};
    const shots = data.shots.shots.map((shot) => this.migratedShot(shot, styles));
    const { layerStyles: _replaced, ...rest } = data.shots;
    return {
      ...data,
      shots: { ...rest, shots, ...(Object.keys(styles).length > 0 ? { layerStyles: styles } : {}) },
    };
  }

  private migratedShot(shot: unknown, styles: Record<string, unknown>): unknown {
    if (!this.isRecord(shot) || !Array.isArray(shot.layers)) return shot;
    return { ...shot, layers: shot.layers.map((layer) => this.migratedLayer(layer, styles)) };
  }

  /** The layer without its motions, which land in its style. */
  private migratedLayer(layer: unknown, styles: Record<string, unknown>): unknown {
    if (!this.isRecord(layer)) return layer;
    const { entrance, exit, ...kept } = layer;
    if (typeof layer.id !== 'string' || layer.id === '') return kept;
    let animations: Record<string, ElementAnimation> = {};
    let css = '';
    for (const [edge, motion] of [['entrance', entrance], ['exit', exit]] as const) {
      const animation = this.animationOf(motion, edge);
      if (animation === null) continue;
      css = this.animationCssWriter.rewrite(css, 'layer', SCOPE_BY_EDGE[edge], undefined, animation);
      animations = { ...animations, [SCOPE_BY_EDGE[edge]]: animation };
    }
    if (Object.keys(animations).length > 0) styles[layer.id] = { kind: 'layer', animations, css };
    return kept;
  }

  private animationOf(motion: unknown, edge: Edge): ElementAnimation | null {
    if (!this.isRecord(motion) || typeof motion.presetId !== 'string' || !V22_PRESETS.has(motion.presetId)) return null;
    const params: Record<string, ElementControlValue> = {};
    const stored = this.isRecord(motion.params) ? motion.params : {};
    for (const [field, value] of Object.entries(stored)) {
      const migrated = this.paramOf(field, value);
      if (migrated !== null) params[field] = migrated;
    }
    return { presetId: `layer-${motion.presetId}-${edge}`, params };
  }

  private paramOf(field: string, value: unknown): ElementControlValue | null {
    if (field === 'direction') return ANGLE_BY_DIRECTION.get(value) ?? null;
    const range = NUMBER_RANGES[field];
    if (range === undefined || typeof value !== 'number' || !Number.isFinite(value)) return null;
    const amount = PERCENT_FIELDS.has(field) ? value / 100 : value;
    return Math.min(range.max, Math.max(range.min, amount));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
