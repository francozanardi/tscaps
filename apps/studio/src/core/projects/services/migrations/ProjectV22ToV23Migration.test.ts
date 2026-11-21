import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { ProjectV22ToV23Migration } from '@core/projects/services/migrations/ProjectV22ToV23Migration';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';

/**
 * Shot layer motions held as a preset the engine read as keyframes, on
 * projects saved before a layer's motion was CSS.
 *
 * The promise is that a layer comes in and leaves the way it did: the
 * same motion at each end, as long, travelling the same way, as strong —
 * now written into the layer's own CSS, where the preview and the export
 * read it.
 */

const writer = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
  new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
));
const migration = new ProjectV22ToV23Migration(writer);
const ENTRANCE = ElementAnimationScope.ENTRANCE;
const EXIT = ElementAnimationScope.EXIT;

function layer(id: string, entrance: unknown, exit: unknown): Record<string, unknown> {
  return { id, mediaId: `${id}-file`, inSec: 0, outSec: null, loop: false, placement: { kind: 'full', fit: 'cover' }, entrance, exit };
}

function migrated(layers: Record<string, unknown>[]): Record<string, unknown> {
  return migration.migrate({ version: 22, shots: { maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers }] } });
}

/** The partition the migrated payload reads as, which is what the preview and the export draw. */
function migratedPartition(layers: Record<string, unknown>[]): ShotPartition {
  return ShotPartition.fromSnapshot(migrated(layers).shots as unknown as ShotsSnapshot);
}

describe('ProjectV22ToV23Migration', () => {
  it('keeps each end\'s motion and its fields, as the layer\'s animation at that end', () => {
    const partition = migratedPartition([layer(
      'clip',
      { presetId: 'pop', params: { duration: 0.7, intensity: 80 } },
      { presetId: 'spin', params: { duration: 0.3, angle: 270 } },
    )]);

    expect(partition.layerStyles.animationOf('clip', ENTRANCE)).toEqual({ presetId: 'layer-pop-entrance', params: { duration: 0.7, intensity: 0.8 } });
    expect(partition.layerStyles.animationOf('clip', EXIT)).toEqual({ presetId: 'layer-spin-exit', params: { duration: 0.3, angle: 270 } });
  });

  it('writes both ends into the layer\'s CSS, as the editor would have', () => {
    const partition = migratedPartition([layer('clip', { presetId: 'slide', params: {} }, { presetId: 'wipe', params: {} })]);
    const style = partition.layerStyles.get('clip')!;

    expect(writer.isTakenOver(style.css, 'layer', ENTRANCE, style.animations![ENTRANCE]!)).toBe(false);
    expect(writer.isTakenOver(style.css, 'layer', EXIT, style.animations![EXIT]!)).toBe(false);
  });

  it('turns the way a layer travels into the angle it travels at', () => {
    const directions = ['right', 'down', 'left', 'up'];
    const partition = migratedPartition(directions.map((direction) => layer(direction, { presetId: 'push', params: { direction } }, null)));

    expect(directions.map((direction) => partition.layerStyles.animationOf(direction, ENTRANCE)?.params['direction']))
      .toEqual(['0deg', '90deg', '180deg', '270deg']);
  });

  it('writes nothing for no motion, a preset v22 did not offer, or a field it did not hold', () => {
    const partition = migratedPartition([
      layer('still', null, undefined),
      layer('unknown', { presetId: 'teleport', params: {} }, { presetId: 'fade', params: { stray: 1, duration: 'slow' } }),
    ]);

    expect(partition.layerStyles.has('still')).toBe(false);
    expect(partition.layerStyles.animationOf('unknown', ENTRANCE)).toBeNull();
    expect(partition.layerStyles.animationOf('unknown', EXIT)).toEqual({ presetId: 'layer-fade-exit', params: {} });
  });

  it('takes the motions off the layers, which now hold only what they show and where', () => {
    const shots = migrated([layer('clip', { presetId: 'fade', params: {} }, null)]).shots as { shots: Array<{ layers: Array<Record<string, unknown>> }> };

    expect(Object.keys(shots.shots[0]!.layers[0]!)).toEqual(['id', 'mediaId', 'inSec', 'outSec', 'loop', 'placement']);
  });

  it('leaves a project with no shots as it was', () => {
    expect(migration.migrate({ version: 22, title: 'x' })).toEqual({ version: 22, title: 'x' });
  });
});
