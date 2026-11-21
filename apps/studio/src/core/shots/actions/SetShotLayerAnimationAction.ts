import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/** A layer's entrance, its exit, or its camera: the parts of a layer's life it moves in. */
export type ShotLayerAnimationScope =
  | ElementAnimationScope.ENTRANCE
  | ElementAnimationScope.EXIT
  | ElementAnimationScope.CAMERA;

/**
 * Changes how shot layers come onto the frame, leave it, or how a camera
 * moves over them, for one layer or several picked together — a
 * shot's own video included, by its `ShotVideoLayerId` — by recording
 * what was picked in each layer's style and writing the block it builds
 * into the layer's own CSS, as a caption element's animation is written.
 * A shot still only proposed is made real first, as any edit to a shot
 * makes it.
 *
 * Picking a preset gives it to every layer with the values that preset
 * recommends, whatever the old one was set to: a duration tuned for a
 * slide is not one for a spin. Picking the one a layer already has
 * leaves that layer as it is, values included. A field reaches only the layers whose preset offers it. Each
 * call is one undo step, and a run of changes to the same field of the
 * same layers — a slider dragged — coalesces into one.
 *
 * A layer whose block was written over by hand in its CSS is left
 * alone: the list has stopped deciding there. So is a layer no shot
 * holds, and the video of a shot the partition does not hold.
 */
export class SetShotLayerAnimationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly catalog: ElementAnimationCatalog,
    private readonly writer: ElementAnimationCssWriter,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** Gives every layer of `layerIds` the preset `presetId` at `scope`, or no motion there for `null`. */
  pick(layerIds: ReadonlyArray<string>, scope: ShotLayerAnimationScope, presetId: string | null): void {
    const changed = this.write(layerIds, scope, `=${presetId ?? 'none'}`, (current) => this.switched(current, presetId));
    if (changed) this.telemetry.motionSet(scope, presetId, layerIds.length);
  }

  /** Sets one field of the preset at `scope`, on every layer of `layerIds` whose preset offers it. */
  setParam(layerIds: ReadonlyArray<string>, scope: ShotLayerAnimationScope, controlId: string, value: ElementControlValue): void {
    this.write(layerIds, scope, `.${controlId}`, (current) => this.withParam(current, controlId, value));
  }

  private write(
    layerIds: ReadonlyArray<string>,
    scope: ShotLayerAnimationScope,
    change: string,
    next: (current: ElementAnimation | undefined) => ElementAnimation | undefined,
  ): boolean {
    const shots = this.materializer.materializeFrom(this.store.snapshot());
    let styles = shots.layerStyles;
    for (const layerId of layerIds) {
      if (!shots.holdsStyleTarget(layerId)) continue;
      styles = this.written(styles, layerId, scope, next);
    }
    if (styles === shots.layerStyles) return false;
    this.store.commit('Change layer motion', `shotLayerAnimation:${[...layerIds].sort().join(',')}:${scope}${change}`);
    this.store.patch({ shots: shots.withLayerStyles(styles) });
    return true;
  }

  private written(
    styles: ElementStyles,
    layerId: string,
    scope: ShotLayerAnimationScope,
    next: (current: ElementAnimation | undefined) => ElementAnimation | undefined,
  ): ElementStyles {
    const style = styles.get(layerId);
    const css = style?.css ?? '';
    const current = style?.animations?.[scope];
    if (current !== undefined && this.writer.isTakenOver(css, 'layer', scope, current)) return styles;
    const animation = next(current);
    if (animation === current) return styles;
    return styles.withAnimation(layerId, 'layer', scope, animation, this.writer.rewrite(css, 'layer', scope, current, animation));
  }

  /** `presetId` at its own defaults; the same animation where it is already that preset. */
  private switched(current: ElementAnimation | undefined, presetId: string | null): ElementAnimation | undefined {
    if (presetId === null) return undefined;
    if (current?.presetId === presetId) return current;
    if (this.catalog.byId(presetId) === null) return current;
    return { presetId, params: {} };
  }

  /** `current` with the field set, kept within what it allows; the same animation where its preset offers no such field. */
  private withParam(current: ElementAnimation | undefined, controlId: string, value: ElementControlValue): ElementAnimation | undefined {
    if (current === undefined || current.presetId === null) return current;
    const control = this.catalog.byId(current.presetId)?.controls.find((candidate) => candidate.id === controlId);
    if (control === undefined) return current;
    const allowed = typeof value === 'number'
      ? Math.min(control.max ?? value, Math.max(control.min ?? value, value))
      : value;
    if (current.params[controlId] === allowed) return current;
    return { ...current, params: { ...current.params, [controlId]: allowed } };
  }
}
